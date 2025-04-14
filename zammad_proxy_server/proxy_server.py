import os
import base64
import json
import logging
import io

from flask import Flask, request, jsonify, send_file, Response, send_from_directory, abort
from flask_cors import CORS
import redis
import requests
from zammad_py import ZammadAPI

from services.zammad_api_v2 import ZammadAPIV2

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger()
app = Flask(__name__)
CORS(app)  # Включаем CORS для всех маршрутов

DEBUG = bool(int(os.getenv("DEBUG", "0")))
APP_URL = os.getenv("ZAMMAD_URL", "http://0.0.0.0:8083/api/v1")
CORP_NAME = os.getenv("ZAMMAD_CORP_NAME")
ZAMMAD_USERNAME = os.getenv("ZAMMAD_USERNAME")
ZAMMAD_PASSWORD = os.getenv("ZAMMAD_PASSWORD")
REDIS_URL = os.getenv("REDIS_URL")


cache_service = redis.Redis.from_url(REDIS_URL)
client = ZammadAPI(url=APP_URL, username=ZAMMAD_USERNAME, password=ZAMMAD_PASSWORD)
client_v2 = ZammadAPIV2(url=APP_URL, username=ZAMMAD_USERNAME, password=ZAMMAD_PASSWORD)

@app.route('/user/init/', methods=['POST'])
def init_user():
    data = request.get_json()
    username = data.get('username')
    username = username.replace("@", "")
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    email = data.get('email')
    customer_exist = client.user.search(
        search_string=f"login:{username}"
    )
    logger.info(f"customer_exist: {list(customer_exist)}")
    if not list(customer_exist):
        result = client.user.create({
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "login": username,
            "organization": CORP_NAME,
            "roles": [
                "Customer"
            ]
        })
    else:
        result = list(customer_exist)[0]
    return jsonify(result), 200

@app.route('/tickets/', methods=['POST'])
def create_ticket():
    """
    Эндпоинт для создания нового тикета в Zammad.
    Ожидаемые параметры:
    - title: Заголовок тикета
    - customer: Email клиента
    - article_body: Сообщение тикета
    """
    # Получаем данные из запроса
    data = request.get_json()
    title = data.get('title')
    article_body = data.get('article_body')
    customer = data.get('customer')
    customer = customer.replace("@", "")

    # Данные для отправки в Zammad
    ticket_data = {
        'title': title,
        'customer': customer,
        'group': "Users",
        'article': {
            'subject': title,
            'body': article_body,
            "type": "note",
            "internal": False
        }
    }
    result = client.ticket.create(ticket_data)
    return jsonify(result), 200


@app.route('/tickets/', methods=['GET'])
def list_tickets():
    """
    Эндпоинт для получения списка тикетов из Zammad.
    """
    customer = request.args.get('customer', default="", type=str)
    is_open = bool(int(request.args.get('is_open', default="1", type=str)))
    page = request.args.get('page', default=1, type=int)
    customer = customer.replace("@", "")
    customer_instance = list(client.user.search(f"login:{customer}"))
    if not customer_instance:
        return jsonify([]), 200
    customer_instance = customer_instance[0]
    open_search_string =  "!(state.name:closed)" if is_open else "state.name:closed"
    result = client.ticket.search(f"customer_id:{customer_instance['id']} AND {open_search_string}", page=page)
    return jsonify(list(result)), 200

@app.route('/tickets/article/new/', methods=['GET'])
def check_new_articles():
    customer = request.args.get('customer', default="", type=str)
    customer = customer.replace("@", "")
    message_key = f"new_message_{customer}"
    alert_key = f"alert_{message_key}"
    is_new = cache_service.get(alert_key)
    logger.info(f"check_new_articles is_new: {is_new}")
    is_new = False if is_new and is_new.decode() != "1" else True
    messages_body = cache_service.get(message_key)
    if not messages_body:
        messages_body = {}
    else:
        messages_body = json.loads(messages_body)
    response_body = {
        "is_new": is_new,
        "messages": messages_body
    }
    cache_service.set(alert_key, "0")
    return jsonify(response_body), 200

@app.route('/tickets/detail/', methods=['GET'])
def detail_ticket():
    """
    Эндпоинт для получения детализации тикета из Zammad.
    """
    customer = request.args.get('customer', default="", type=str)
    customer = customer.replace("@", "")
    id = request.args.get('id', default="", type=str)
    result = client.ticket.find(id)
    chats = client_v2.get_articles_by_ticket(id)
    result["chats"] = chats
    return jsonify(result), 200


@app.route('/tickets/article/', methods=['POST'])
def create_article():
    # Извлекаем текстовые данные из формы
    ticket_id = request.form.get("ticket_id")
    article_body = request.form.get("article_body")

    # Извлекаем файлы
    files = request.files.getlist("attachments[]")  # Получаем список файлов
    # Обработка файлов и данных

    # Пример сохранения файла
    payload = {
            "ticket_id": int(ticket_id),
            "body": article_body,
            "content_type": "text/plain",
            "type": "web",
            "internal": False,
            "sender": "Customer",
        }
    attachments = []
    for file in files:
        # Сохраняем файл
        file_content = file.read()
        encoded_content = base64.b64encode(file_content).decode('utf-8')

        # Добавляем вложение в список
        attachments.append({
            "filename": file.filename,
            "data": encoded_content,
            "mime-type": file.mimetype  # Получаем MIME-тип файла
        })
    if attachments:
        payload["attachments"] = attachments
    # Вызов API для создания статьи
    result = client.ticket_article.create(payload)
    return jsonify(result), 200

@app.route('/attachment/', methods=['GET'])
def get_attachment():
    ticket_id = request.args.get('ticket_id', default="", type=str)
    chat_id = request.args.get('chat_id', default="", type=str)
    attachment_id = request.args.get('attachment_id', default="", type=str)
    # Формируем полный URL для запроса к Zammad
    full_url = f"{APP_URL}/ticket_attachment/{ticket_id}/{chat_id}/{attachment_id}"
    
    # Делаем запрос к Zammad с нужными данными
    headers = {
        "Content-Type": "appliaction/json",
        "Accept": "application/json"
    }
    response = requests.get(full_url, headers=headers, auth=(ZAMMAD_USERNAME, ZAMMAD_PASSWORD))
    
    # Проверяем, был ли запрос успешным
    if response.status_code != 200:
        return Response(response.text, status=response.status_code, mimetype="application/json")
        # Отправляем файл обратно клиенту
    filename = response.headers.get("Content-Disposition", "").split('filename="')[-1].split('";')[0]
    return send_file(
        io.BytesIO(response.content),
        mimetype=response.headers["Content-Type"],
        as_attachment=True,
        download_name=filename
        )

@app.route('/zammad/callback/', methods=['POST'])
def zammad_callback():
    # Попробуй получить JSON снова
    data = request.get_json(silent=True)
    logger.info(f"Parsed JSON Data: {data}")
    key = f"{data['action']}_{data['username']}"
    ticket_id = str(data['ticket_id'])
    messages_body = cache_service.get(key)
    if not messages_body:
        messages_body = {
            ticket_id: 1
        }
    else:
        messages_body = json.loads(messages_body)
        if ticket_id not in messages_body:
            messages_body[ticket_id] = 1
        else:
            messages_body[ticket_id] += 1
    cache_service.set(key, json.dumps(messages_body))
    key_alert = f"alert_{key}"
    res = cache_service.set(key_alert, "1")
    logger.info(f"result: {messages_body}")
    return jsonify({}), 200

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    try:
        return send_from_directory('assets', filename)
    except FileNotFoundError:
        abort(404) 

if __name__ == '__main__':
    app.run(debug=DEBUG)
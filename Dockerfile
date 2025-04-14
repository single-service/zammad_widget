# Используем официальный образ Python 3.x
FROM python:3.10-slim-buster

ENV FLASK_APP=proxy_server.py
# Устанавливаем рабочую директорию
WORKDIR /zammad_proxy_server

# Экспонируем порт, на котором слушает приложение
EXPOSE 5000
# Копируем только требования и устанавливаем зависимости заранее
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./zammad_proxy_server .

# Команда для запуска приложения
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0"]
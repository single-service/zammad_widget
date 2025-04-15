# Сервис тех поддержки

## Описание
Сервис на основе Zammad. Также есть отдельный контейнер отвечающий за работу виджета

## Установка
```sh
docker-compose up -d --build
```

## Настройка админки
После первого запуска заходим на nginx(port 8083). Вводим данные админа.
Меняем язык
Добавляем вебхук(Настройки -> Веб перехватчики)
Тело вебхука
```json
{
  "action": "new_message",
  "sender": "#{article.sender.name}",
  "ticket_id": "#{article.ticket_id}",
  "article_id": "#{article.id}",
  "customer_id": "#{ticket.customer_id}",
  "username": "#{ticket.customer.login}",
  "articles_count": "#{ticket.article_count}"
}
```
Затем создаем триггер
```txt
Условия:
Статья/Создал => соответствует текущий пользователь
Применить изменения к объектам
Вебхук -> Созданный вебхук
```
Создаем нашу организацию
Создаем агента

## Настройка UI
В html в head добавляем
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.2/dist/umd/popper.min.js" integrity="sha384-IQsoLXl5PILFhosVNubq5LC7Qb9DXgDA9i+tQ8Zj3iwWAwPtgFTxbJ8NT4GN1R8p" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.min.js" integrity="sha384-cVKIPhGWiC2Al4u+LWgxfKTRIcfu0JTxR+EQDz/bgldoEyl4H0zUF0QKbrJ0EcQF" crossorigin="anonymous"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>

<link rel="stylesheet" href="http://0.0.0.0:5000/assets/zammad_widget.css?v=12"/>
<script src="http://0.0.0.0:5000/assets/zammad_widget.js?v=12"></script>
```
В js
```javascript
createZammadWidget(
    "support_container",
    "http://0.0.0.0:5000",
    {
        "email": "1@disosedov.com",
        "username": "disosedov",
        "first_name": "Дмитрий",
        "last_name": "Соседов"
    },
    {
        "logo": "lc_mobile_580px_r16x9_pd20.webp"
    }
)
```

var ZammadView;

class ZammadTicketDetailView {

    showTicketDetailView = async (ticket_id=null) => {
        this.show_preloader()
        if(!ticket_id){
            let el = event.currentTarget
            ticket_id = el.getAttribute("data-ticket-id")
        }
        this.ticketList.style.display = 'none';
        this.newTicketForm.style.display = 'none';
        this.ticketsDetailView.style.display = 'block';
        document.querySelector(".zammad_chat-message-send-button").setAttribute("data-ticket-id", ticket_id)
        let ticket = await this.loadDetailView(ticket_id)
        this.renderTicketDetail(ticket);
        let messages_elements = document.getElementById('zammad_chat-main-container').children
        let lastElement = messages_elements[messages_elements.length -1]
        // Прокручиваем до последнего элемента
        lastElement.scrollIntoView({ behavior: 'smooth' })
        this.sendReadMessages(ticket_id)
        this.INTERVAL_MESSAGE_CHECKER = setInterval(() => {
            this.getMessagesChat()
        }, 10000)
        this.hide_preloader()
    }

    loadDetailView = async (ticket_id) => {
        if(!this.CURRENT_TICKETS_ISOPEN){
            document.querySelector(".zammad_chat-message-container").style.display = "none"
        }else{
            document.querySelector(".zammad_chat-message-container").style.display = "flex"
        }
        try {
            const response = await fetch(`${this.base_api_url}/tickets/detail/?customer=${this.CUSTOMER.username}&id=${ticket_id}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                }
            });

            if (!response.ok){
                let res = await response.text
                return
            }
            const ticket = await response.json();
            return ticket
        } catch (error) {
            alert(error.message);
        }
    }

    formChatBody = (item, i) => {
        var today =  new Date()
        var chat_timestamp = new Date(item.created_at);
        let time_str = ""
        if (chat_timestamp.toDateString() === today.toDateString()) {
            time_str = chat_timestamp.toLocaleTimeString('ru-RU', { hour: 'numeric', minute: 'numeric' }).replace(/:/g, ':')
        }else if(chat_timestamp.getFullYear() === today.getFullYear()){
            time_str = chat_timestamp.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric' })
        }else{
            time_str = chat_timestamp.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric' })
        }
        
        
        let time_side = "right"
        let assistent_header = ""
        if(i>0 && item.sender == "Agent"){
            time_side = "left"
            assistent_header = "<sub>Менеджер</sub><hr/>"
        }
        let attachments_html = ""
        item.attachments.forEach((att_item) => {
            let file_format = att_item.filename.split(".").pop().toLowerCase()
            let file_link = `${this.base_api_url}/attachment/?ticket_id=${item.ticket_id}&chat_id=${item.id}&attachment_id=${att_item.id}`
            if(file_format == "png" || file_format == "jpg" || file_format == "jpeg"){
                attachments_html += `
                    <img src="${file_link}"/><br/>
                `
            }else{
                attachments_html += `<a href="${file_link}" target="_blank">${att_item.filename}</a><br/>`
            }
        })
        return `
            ${assistent_header}
            <p>${item.body}</p><br/>
            ${attachments_html}
            <span class="zammad_chat-time-${time_side}">${time_str}</span>
        `
    }

    renderTicketDetail = (ticket) => {
        const ticketsDetailViewTitle = document.getElementById("zammad_ticketsDetailViewTitle")
        const chatMainContainer = document.getElementById("zammad_chat-main-container")
        ticketsDetailViewTitle.innerHTML = `Заявка #${ticket.number}`
        let chats_html = ""
        ticket.chats.forEach((item, i) => {
            let chat_body = this.formChatBody(item, i)
            let darker = i>0 && item.sender == "Agent" ? "zammad_chat-darker" : ""
            chats_html += `
            <div class="zammad_chat-container ${darker}" id="zammad_chat-container_${item.id}">
                ${chat_body}
            </div>
            `
        })
        chats_html += `<span class="zammad_chat-anchor"></span>`
        chatMainContainer.innerHTML = chats_html
    }

    send_article = async () => {
        let ticket_id = document.querySelector(".zammad_chat-message-send-button").getAttribute("data-ticket-id");
        let message = document.querySelector(".zammad_chat-message-input").value;
        let attachments_field = document.querySelector(".zammad_chat-message-attachments");
        let error = this.validateNewArticle(message)
        if(error){
            this.popup("Ошибка!", error, "error")
            return
        }
    
        // Создаем объект FormData для отправки данных и файлов
        const formData = new FormData();
    
        // Добавляем текстовые данные
        formData.append("ticket_id", ticket_id);
        formData.append("customer", this.CUSTOMER.username);
        formData.append("article_body", message);
    
        // Проверяем наличие файлов и добавляем их в FormData
        if (attachments_field.files && attachments_field.files.length > 0) {
            for (let i = 0; i < attachments_field.files.length; i++) {
                formData.append("attachments[]", attachments_field.files[i]);
            }
        }
        // Выполняем запрос с FormData
        const response = await fetch(`${this.base_api_url}/tickets/article/`, {
            method: 'POST',
            body: formData,  // Используем FormData вместо JSON
        });
    
        if (!response.ok) {
            let res = response.text;
            return;
        }
    
        const article = await response.json();
        document.querySelector(".zammad_chat-message-input").value = ""
        document.querySelector(".zammad_chat-message-attachments").type="text"
        document.querySelector(".zammad_chat-message-attachments").type="file"
        await this.showTicketDetailView(ticket_id)
    }

    validateNewArticle = (message) => {
        let error = null
        if(message.trim().length == 0){
            error = "Необходимо написать сообщение"
        }
        return error
    }

    checkNewMessages = async () => {
        try {
            const response = await fetch(`${this.base_api_url}/tickets/article/new/?customer=${this.CUSTOMER.username}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                }
            });
    
            // if (!response.ok) throw new Error(`Не удалось загрузить тикеты:${response.text}`);
            if (!response.ok){
                let res = response.text
                return
            }
            let result = await response.json();
            console.log("New messages", result)
            if(result.is_new){
                this.popup("Новые сообщения", "", "info")
            }
            this.setNewMessages(result["messages"])
            // проверка если я уже в нужно чате
            if(this.ticketsDetailView.style.display == "block"){
                let ticket_id = document.querySelector(".zammad_chat-message-send-button").getAttribute("data-ticket-id")
                if(this.NEW_MESSAGES_MAP.hasOwnProperty(ticket_id)){
                    await this.sendReadMessages(ticket_id)
                }
            } 
            return
        } catch (error) {
            alert(error)
        }
    }

    setNewMessages = (messages_map=null) => {
        if(messages_map){
            this.NEW_MESSAGES_MAP = messages_map
        }
        let rows = document.getElementsByClassName("zammad-new-message-row")
        for(let i=0; i<rows.length; i++){
            let el = rows[i]
            let ticket_id = el.getAttribute("data-ticket-id").toString()
            let messages_count = this.NEW_MESSAGES_MAP[ticket_id]
            let text = ""
            if(messages_count){
                text = `${messages_count} новых сообщений`
                if(messages_count == 1){
                    text = `1 новое сообщение`
                }
            }
            el.innerHTML = text
        }
    }

    sendReadMessages = async (ticket_id) => {
        if(!this.NEW_MESSAGES_MAP[ticket_id]){
            return
        }
        try {
            const response = await fetch(`${this.base_api_url}/articles/read/`, {
                method: 'PUT',
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    customer: this.CUSTOMER.username,
                    ticket_id: ticket_id
                })
            });

            if (!response.ok){
                let res = response.text
                return
            }
            delete this.NEW_MESSAGES_MAP[ticket_id]
            this.setNewMessages()
        } catch (error) {
            alert(error.message);
        }
    }

    getMessagesChat = async () => {
        let ticket_id = document.querySelector(".zammad_chat-message-send-button").getAttribute("data-ticket-id")
        let ticket = await this.loadDetailView(ticket_id)
        let chats = ticket.chats
        const chat_container = document.getElementById("zammad_chat-main-container")
        let is_changed = false
        chats.forEach((item, i) => {
            if(!is_changed){
                is_changed = true
            }
            let mes = document.getElementById(`zammad_chat-container_${item.id}`)
            if(!mes){
                let chat_body = this.formChatBody(item, i)
                let darker = i>0 && item.sender == "Agent" ? "zammad_chat-darker" : ""
                let new_mes_el = document.createElement("div")
                new_mes_el.classList.add("zammad_chat-container")
                new_mes_el.id = `zammad_chat-container_${item.id}`
                if(darker != ""){
                    new_mes_el.classList.add(darker)
                }
                new_mes_el.innerHTML = chat_body
                chat_container.appendChild(new_mes_el)
                console.log("Сообщение добавлено", item)
            }
        })
        if(is_changed){
            let anchor = document.querySelector(".zammad_chat-anchor")
            anchor.parentNode.removeChild(anchor)
        }
        console.log("getMessagesChat ticket", ticket)
    }
}


class ZammadTicketCreateMixin extends ZammadTicketDetailView {

    constructor(){
        super()
    }

    clearForm = () => {
        document.getElementById('zammad_newTicketSubject').value = '';
        document.getElementById('zammad_newTicketMessage').value = '';
    }
    
    
    
    showAddForm = () => {
        this.ticketList.style.display = 'none';
        this.newTicketForm.style.display = 'flex';
        this.ticketsDetailView.style.display = 'none';
    }

    // Функция для создания нового тикета
    createNewTicket = async (event) => {
        event.preventDefault();
        this.show_preloader()
        let {subject, message, error} = this.validateNewTicketForm()
        if(error){
            this.hide_preloader()
            this.popup("Ошибка!", error, "error")
            return
        }
        document.getElementById("zammad_newTicketSubmit").setAttribute("disabled", "disabled")

        
        let is_error = false
        let error_msg = ""
        let ticket = null
        try {
            const response = await fetch(`${this.base_api_url}/tickets/`, {
                method: 'POST',
                body: JSON.stringify({
                    title: subject,
                    customer: this.CUSTOMER.username,
                    article_body: message
                }),
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Не удалось создать тикет');

            ticket = await response.json();
            this.NEW_TICKETS.push(ticket)
            this.clearForm();
        } catch (error) {
            error_msg = error.message
            is_error = true
        }

        document.getElementById("zammad_newTicketSubmit").removeAttribute("disabled")
        this.hide_preloader()
        if(is_error){
            this.popup('Ошибка!', error_msg, "error")
        }else{
            this.popup('Заявка создана!', `Номер заявки: ${ticket.number}`)
        }

    }

    validateNewTicketForm = () => {
        const subject_field = document.getElementById('zammad_newTicketSubject')
        const message = document.getElementById('zammad_newTicketMessage').value.trim();
        if(subject_field.value == "0"){
            return {"subject": null, "message": null, "error": "Выберите тему"}
        }
        if(message.length == 0){
            return {"subject": null, "message": null, "error": "Распишите проблему"}
        }
        const subject = subject_field.options[subject_field.selectedIndex].text
        return {"subject": subject, "message": message, "error": null}
    }

    backFromCreate = async () => {
        await this.showTickets()
        this.showTicketsView()
    }
}


class ZammadTicketListMixin extends ZammadTicketCreateMixin{

    constructor(){
        super()
    }

    showTicketsView = () => {
        this.ticketList.style.display = 'flex';
        this.newTicketForm.style.display = 'none';
        this.ticketsDetailView.style.display = 'none';
        document.getElementById("zammad_main_header").scrollIntoView({ behavior: 'instant' })
        if(this.INTERVAL_MESSAGE_CHECKER !== null){
            clearInterval(this.INTERVAL_MESSAGE_CHECKER)
            this.INTERVAL_MESSAGE_CHECKER = null
        }
    }

    showTickets = async (is_open="1", page=1) => {
        this.show_preloader()
        try {
            const tickets = await this.getTickets(is_open, page)
            await this.renderTicketList(tickets);
        } catch (error) {
            alert(error.message);
        }
        this.hide_preloader()
    }

    // Рендеринг списка тикетов
    renderTicketList = async (tickets) => {
        this.ticketListContainer.innerHTML = '';
        let html = ""
        let counter = 0
        // сравнить пришли ли в тикетах новые
        let ticket_ids = tickets.map((ticket) => {return ticket.id})
        //render new tickets
        if(this.NEW_TICKETS.length > 0){
            this.NEW_TICKETS.forEach(ticket => {
                if(!ticket_ids.includes(ticket.id)){
                    html += this.renderTicketBody(ticket)
                    counter += 1
                }
            });
            this.NEW_TICKETS = []
        }
        tickets.forEach(ticket => {
            if(counter < 10){
                html += this.renderTicketBody(ticket)
                counter += 1
            }
        });
        this.ticketListContainer.innerHTML = html;
        this.ticketListContainer.style.display = 'flex';
        await this.formTicketsPagination()
        this.setNewMessages()
    }

    getTickets = async (is_open="1", page=1) => {
        try {
            const response = await fetch(`${this.base_api_url}/tickets/?customer=${this.CUSTOMER.username}&is_open=${is_open}&page=${page}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                }
            });
    
            // if (!response.ok) throw new Error(`Не удалось загрузить тикеты:${response.text}`);
            if (!response.ok){
                let res = response.text
                return
            }
            const tickets = await response.json();
            return tickets
        } catch (error) {
            alert(error.message);
        }
    }

    renderTicketBody = (ticket) =>{
        return `
            <div class="card" style="width: 100%;margin-bottom: 10px;" onclick="ZammadView.showTicketDetailView()" data-ticket-id="${ticket.id}">
                <div class="card-body">
                    <h5 class="card-title">${ticket.title}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">Номер заявки #${ticket.number}</h6>
                    <p class="card-text"><i class="zammad-new-message-row" data-ticket-id="${ticket.id}"></i></p>
                </div>
            </div>
        `
    }

    formTicketsPagination = async () => {
        let pag_prev_btn = document.getElementById("zammad_pag_prev_btn")
        let pag_next_btn = document.getElementById("zammad_pag_next_btn")
        if(this.CURRENT_TICKETS_PAGE != 1){
            pag_prev_btn.removeAttribute("disabled")
            pag_prev_btn.style.display = "block"
            pag_prev_btn.parentNode.style.flexDirection = "row"
        }else{
            pag_prev_btn.setAttribute("disabled","disabled")
            pag_prev_btn.style.display = "none"
            pag_prev_btn.parentNode.style.flexDirection = "row-reverse"
        }
        let is_open = this.CURRENT_TICKETS_ISOPEN ? "1" : "0"
        let next_tickets = await this.getTickets(is_open, this.CURRENT_TICKETS_PAGE+1)
        if (next_tickets.length > 0) {
            pag_next_btn.removeAttribute("disabled")
            pag_next_btn.style.display = "block"
        }else{
            pag_next_btn.setAttribute("disabled","disabled")
            pag_next_btn.style.display = "none"
        }
        document.querySelector(".zammad_tickets_pagination").style.display = "flex"
    }
    
    toggle_tickets_closed = async () => {
        this.show_preloader()
        let btns =document.getElementsByClassName("zammad_tickets_type_btns")
        let el = event.currentTarget
        let is_open = el.getAttribute("data-is-open")
        this.CURRENT_TICKETS_ISOPEN = is_open == "1" ? true : false
        for(let i=0;i<btns.length;i++){
            let btn = btns[i]
            btn.classList.remove("active")
            if(btn.getAttribute("data-is-open") == is_open){
                btn.classList.add("active")
            }
        }
        this.CURRENT_TICKETS_PAGE = 1
        await this.showTickets(is_open, 1)
        this.hide_preloader()
    }

     toTicketsPage = async () => {
        this.show_preloader()
        let el = event.currentTarget
        let pagType = el.getAttribute("data-type")
        if(pagType == "0") {
            this.CURRENT_TICKETS_PAGE -= 1
        }else{
            this.CURRENT_TICKETS_PAGE += 1
        }
        let is_open = this.CURRENT_TICKETS_ISOPEN ? "1" : "0"
        await this.showTickets(is_open, this.CURRENT_TICKETS_PAGE)
        this.hide_preloader()
    }
}




class ZammadWidget extends ZammadTicketListMixin{

    constructor(
        container_id,
        base_api_url,
        client,
        header=null,
    ){
        /* Params
         client = {
            "email"
            "username"
            "first_name"
            "last_name"
         }
         header = {
            "bg_color"
            "color"
            "logo"
         }
         base_api_url = "http://my_zammad_api.com"
         */
        super()
        this.base_api_url = base_api_url
        let parentContainer = document.getElementById(container_id)
        this.createUI(parentContainer, header)
        this.ticketList = document.getElementById('zammad_ticketListView');
        this.ticketsDetailView = document.getElementById("zammad_ticketsDetailView");
        this.ticketListContainer = document.getElementById('zammad_tickets_container');
        this.newTicketForm = document.getElementById('zammad_newTicketForm');

        this.CUSTOMER = client
        this.CURRENT_TICKETS_PAGE = 1
        this.CURRENT_TICKETS_ISOPEN=true
        this.NEW_TICKETS = []
        this.NEW_MESSAGES_MAP = {}
        this.INTERVAL_MESSAGE_CHECKER = null

        this.widget_load()
    }

    createUI = (parentContainer, header_settings) => {
        let header_bg_color = "blueviolet"
        let header_color = "white"
        let header_logo = ""
        if(header_settings){
            header_bg_color = header_settings.bg_color ? header_settings.bg_color : header_bg_color
            header_color = header_settings.color ? header_settings.color : header_color
            if(header_settings.logo){
                header_logo = `<img src="${header_settings.logo}" width="40" height="40"/>`
            }
        }
        let html = `
            <div id="zammad_app">
                <div id="zammad_main_header" style="background-color:${header_bg_color};color:${header_color};">
                    ${header_logo}
                    <h2>Поддержка клиентов</h2>
                </div>
                
                <div id="zammad_ticketListView">
                    <button id="zammad_ticketListViewAddBtn" class="btn btn-outline-secondary" onclick="ZammadView.showAddForm()">+</button>
                    <div class="btn-group" role="group">
                        <button type="button" class="zammad_tickets_type_btns btn btn-outline-dark active" data-is-open="1" onclick="ZammadView.toggle_tickets_closed()">Открытые</button>
                        <button type="button" class="zammad_tickets_type_btns btn btn-outline-dark" data-is-open="0" onclick="ZammadView.toggle_tickets_closed()">Закрытые</button>
                    </div>
                    <div id="zammad_tickets_container"></div>
                    <div class="zammad_tickets_pagination">
                        <button id="zammad_pag_prev_btn" class="btn btn-outline-dark" disabled data-type="0" onclick="ZammadView.toTicketsPage()"><<</button>
                        <button id="zammad_pag_next_btn" class="btn btn-outline-dark" data-type="1" onclick="ZammadView.toTicketsPage()">>></button>
                    </div>
                </div>

                <div id="zammad_ticketsDetailView" style="display: none;">
                    <div id="zammad_ticketsDetailViewHeader">
                        <button class="btn btn-light" onclick="ZammadView.showTicketsView()">Назад</button>
                        <h5 id="zammad_ticketsDetailViewTitle">Заявка #</h5>
                    </div>
                    <div id="zammad_chat-main-container">
                        
                    </div>
                    <div class="zammad_chat-message-container">
                        <textarea class="zammad_chat-message-input form-control" placeholder="Ваше сообщение..." rows="4"></textarea>
                        <input type="file" class="zammad_chat-message-attachments form-control-file" multiple>
                        <button class="zammad_chat-message-send-button btn btn-dark" onclick="ZammadView.send_article()">Отправить</button>
                    </div>
                </div>


                <form id="zammad_newTicketForm" style="display: none;">
                    <div class="mb-3">
                        <label for="zammad_newTicketSubject" class="form-label">Тема:</label>
                        <select class="form-control" id="zammad_newTicketSubject">
                            <option value="0">Выберите тему обращения</option>
                            <option value="1">Технические проблемы</option>
                            <option value="2">Аккаунт</option>
                            <option value="3">Вопросы по финансам</option>
                            <option value="4">Исполнители</option>
                            <option value="5">Аккаунт и профиль</option>
                            <option value="6">Другое</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="zammad_newTicketMessage" class="form-label">Сообщение:</label>
                        <textarea class="form-control" id="zammad_newTicketMessage"></textarea>
                    </div>
                    <button id="zammad_newTicketSubmit" class="btn btn-outline-success" type="submit">Отправить</button>
                    <button type="button" class="btn btn-secondary" onclick="ZammadView.backFromCreate()">Назад</button>
                </form>
        </div>
        <div class="zammad_preloader">
            <div class="spinner-grow text-dark" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        `
        parentContainer.innerHTML = html
    }

    widget_load = () => {
        this.init_customer()
        this.newTicketForm.addEventListener('submit', this.createNewTicket);
        this.showTickets()
        this.checkNewMessages()
        this.showTicketsView()
        setInterval(()=> {
            this.checkNewMessages()
        }, 10000)
    }

    show_preloader = () => {
        document.querySelector(".zammad_preloader").style.display = "flex"
    }
    
    hide_preloader = () => {
        document.querySelector(".zammad_preloader").style.display = "none"
    }
    
    popup = (title, content, icon="success") => {
        Swal.fire({
            icon: icon,
            title: title,
            text: content,
            position: 'top-end',  // Позиция справа сверху
            timer: 2500,          // Автоматическое закрытие через 2.5 секунды
            toast: true,           // Сделать уведомление в стиле "toast"
            showConfirmButton: false,  // Скрыть кнопку подтверждения
        });
    }

    init_customer = async () => {
        try {
            const response = await fetch(`${this.base_api_url}/user/init/`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    "email": this.CUSTOMER.email,
                    "username": this.CUSTOMER.username,
                    "first_name": this.CUSTOMER.first_name,
                    "last_name": this.CUSTOMER.last_name,
                })
            });
    
            // if (!response.ok) throw new Error(`Не удалось загрузить тикеты:${response.text}`);
            if (!response.ok){
                let res = response.text
                return
            }
            const tickets = await response.json();
            return tickets
        } catch (error) {
            alert(error)
            alert("Пользователь не найден!");
        }
    }
}

function createZammadWidget(){
    ZammadView = new ZammadWidget(
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
}
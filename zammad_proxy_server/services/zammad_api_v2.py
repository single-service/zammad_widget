import requests

class ZammadAPIV2():
    def __init__(self, url, username, password):
        self.url = url
        self.username=username
        self.password=password
        self.headers = {
            # "Authorization": f"Token token={token}",
            "Content-Type": "appliaction/json",
            "Accept": "application/json"
        }

    def get_articles_by_ticket(self, ticket_id):
        url = f"{self.url}/ticket_articles/by_ticket/{ticket_id}"
        response = requests.get(url, headers=self.headers, auth=(self.username, self.password))
        return response.json()
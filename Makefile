docker_login:
	docker login -u singleservice

build:
	docker build -t singleservice/zammad-widget-proxy-server:0.0.2 .
	docker build -t singleservice/zammad-widget-proxy-server:latest .

push:
	docker push singleservice/zammad-widget-proxy-server:0.0.2
	docker push singleservice/zammad-widget-proxy-server:latest
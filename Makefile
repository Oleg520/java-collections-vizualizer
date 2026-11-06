.PHONY: build test backend frontend e2e
build:
	./mvnw -B verify
	npm --prefix frontend ci
	npm --prefix frontend run build

test:
	./mvnw -B test
	npm --prefix frontend test

backend:
	java -jar backend/target/backend-0.1.0.jar

frontend:
	npm --prefix frontend run dev

e2e:
	npm --prefix frontend run test:e2e

.PHONY: setup build test backend frontend e2e

# Prepare a fresh clone for the two-terminal development workflow.
setup:
	./mvnw -B clean package -DskipTests
	npm --prefix frontend ci

build:
	./mvnw -B clean verify
	npm --prefix frontend ci
	npm --prefix frontend run build

test:
	./mvnw -B test
	npm --prefix frontend test

backend:
	"$${JAVA_HOME:+$$JAVA_HOME/bin/}java" -jar "$$(sh scripts/backend-jar.sh)"

frontend:
	npm --prefix frontend run dev

e2e:
	npm --prefix frontend run test:e2e

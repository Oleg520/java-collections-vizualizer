FROM eclipse-temurin:21-jdk AS build
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY .git .git
COPY scripts scripts
COPY core core
COPY backend backend
RUN chmod +x mvnw && ./mvnw -B clean verify && cp "$(sh scripts/backend-jar.sh)" /workspace/app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/app.jar app.jar
USER 10001:10001
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseContainerSupport"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

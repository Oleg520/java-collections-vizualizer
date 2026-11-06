FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY core core
COPY backend backend
RUN chmod +x mvnw && ./mvnw -B verify

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/backend/target/backend-0.1.0.jar app.jar
USER 10001:10001
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseContainerSupport"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

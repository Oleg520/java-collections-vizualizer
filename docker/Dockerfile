# The build context contains only the exact JAR already verified by application CI.
FROM eclipse-temurin:21-jre-noble@sha256:42b0171b55ff43cbb258de3a1c4a81cb11a96c15b2d8d9a9284a252c1d038605
ARG REVISION
ARG JAR_SHA256
ARG APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/Oleg520/java-collections-vizualizer" \
      org.opencontainers.image.revision="$REVISION" \
      org.opencontainers.image.version="$APP_VERSION" \
      dev.collectionsviz.jar.sha256="$JAR_SHA256"
WORKDIR /app
COPY --chmod=0444 backend.jar /app/backend.jar
RUN test "$(sha256sum /app/backend.jar | cut -d ' ' -f 1)" = "$JAR_SHA256"
ENV SERVER_ADDRESS=0.0.0.0 PORT=8080 HOME=/tmp
USER 10001:10001
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/v1/health" || exit 1
# Bypass base-image certificate initialization: immutable non-root runtime.
ENTRYPOINT ["java"]
CMD ["-jar", "/app/backend.jar"]

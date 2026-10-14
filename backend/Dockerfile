# --- Compilación ---
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
# Capa aparte con las dependencias: solo se vuelve a descargar si cambia el pom.xml
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q package -DskipTests

# --- Ejecución ---
FROM eclipse-temurin:25-jre
RUN useradd --system --create-home estudio \
    && mkdir -p /app/data \
    && chown -R estudio /app
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
USER estudio
# La base de datos H2 se guarda en /app/data (montado como volumen)
VOLUME /app/data
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

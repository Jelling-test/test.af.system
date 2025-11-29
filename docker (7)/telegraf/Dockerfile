FROM telegraf:1.30

# Installer PostgreSQL client libraries
USER root
RUN apt-get update && \
    apt-get install -y postgresql-client libpq-dev && \
    rm -rf /var/lib/apt/lists/*

USER telegraf

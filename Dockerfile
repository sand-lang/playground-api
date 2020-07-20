FROM ubuntu:20.04

RUN apt-get update

RUN apt install -y libxml2
RUN apt install -y libncurses5

RUN apt install -y curl

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt install -y nodejs

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

EXPOSE 4000
CMD [ "npm", "start" ]

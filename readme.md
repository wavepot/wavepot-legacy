# wavepot <3

-=- work in progress -=-

visit https://wavepot.com

uses Chrome

Experimental Web Platform features must be enabled from chrome://flags

to run locally you'd need to run a static web server with https enabled.

this is what i use:
```sh
npm install live-server -g
npm install live-server-https -g
live-server --https=/home/stagas/.nvm/versions/node/v12.9.1/lib/node_modules/live-server-https
```

paths should vary depending on your system

ALSO, chrome needs to run as follows for https to work in localhost:

```sh
google-chrome --ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=https://127.0.0.1:8080/ &
```

and after that it should hopefully work :)

please join [the mailing list](https://groups.google.com/forum/#!forum/wavepot) to give feedback and to keep up with the development

share the love and keep scripting <3

module.exports = function (RED) {
  'use strict';
  const { Client } = require('@opensearch-project/opensearch'); // Импортируем клиент OpenSearch

  function serverConfigNode(config) {
    const node = this;
    RED.nodes.createNode(node, config);

    // Инициализация параметров из конфигурации
    node.server = config.server; // URL сервера OpenSearch
    node.name = config.name; // Имя конфигурации
    node.timeout = config.timeout || 30000; // Таймаут запроса (по умолчанию 30 секунд)
    node.auth = config.auth; // Параметры аутентификации (опционально)

    // Создание клиента OpenSearch
    createClient(node);

    // Обработка ошибок
    node.on('error', function (error) {
      node.error('OpenSearch Server Error - ' + error);
    });

    // Очистка ресурсов при закрытии узла
    node.on('close', function (done) {
      if (node.client) {
        node.client.close(); // Закрытие клиента OpenSearch
      }
      done();
    });
  }

  function createClient(node) {
    try {
      if (!node.client) {
        // Создание клиента OpenSearch
        node.client = new Client({
          node: node.server, // URL сервера OpenSearch
          requestTimeout: node.timeout, // Таймаут запроса
          auth: node.auth, // Параметры аутентификации (Basic Auth или AWS Sigv4)
          ssl: {
            rejectUnauthorized: false, // Отключение проверки SSL-сертификата (опционально)
          },
        });

        // Логирование событий
        node.client.on('request', (err, meta) => {
          if (err) {
            node.error(`Request Error: ${err}`);
          } else {
            node.log(`Request Sent: ${JSON.stringify(meta)}`);
          }
        });

        node.client.on('response', (err, meta) => {
          if (err) {
            node.error(`Response Error: ${err}`);
          } else {
            node.log(`Response Received: ${JSON.stringify(meta)}`);
          }
        });

        node.client.on('sniff', (err, meta) => {
          if (err) {
            node.error(`Sniff Error: ${err}`);
          } else {
            node.log(`Sniff Event: ${JSON.stringify(meta)}`);
          }
        });

        node.client.on('resurrect', (err, meta) => {
          if (err) {
            node.error(`Resurrect Error: ${err}`);
          } else {
            node.log(`Resurrect Event: ${JSON.stringify(meta)}`);
          }
        });
      }
    } catch (err) {
      node.error('createClient - ' + err);
    }
  }

  RED.nodes.registerType('opensearch-config', serverConfigNode, {});
};

module.exports = function (RED) {
  'use strict';

  function opensearchGetNode(config) {
    try {
      const node = this;
      RED.nodes.createNode(node, config);

      // Получаем конфигурацию сервера OpenSearch
      const serverConfig = RED.nodes.getNode(config.server);
      if (!serverConfig || !serverConfig.client) {
        node.status({
          fill: 'red',
          shape: 'dot',
          text: 'No OpenSearch client found',
        });
        return;
      }

      node.status({});

      // Обработка входящих сообщений
      node.on('input', function (msg) {
        const getConfig = {
          index: config.index, // Индекс из конфигурации узла
          id: config.esId, // ID документа из конфигурации узла
          routing: config.routing, // Routing из конфигурации узла
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          getConfig.index = msg.index;
        }

        // Переопределение ID документа из входящего сообщения
        if (msg.id) {
          getConfig.id = msg.id;
        }

        // Переопределение routing из входящего сообщения
        if (msg.routing) {
          getConfig.routing = msg.routing;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .get(getConfig)
          .then((resp) => {
            msg.payload = {};

            // Извлечение данных из ответа
            if (resp && resp.body._source) {
              msg.payload = resp.body._source; // Данные документа
            }

            // Добавление метаданных
            if (resp.body._id) {
              msg.payload._id = resp.body._id; // ID документа
            }
            if (resp.body._index) {
              msg.payload._index = resp.body._index; // Индекс
            }
            if (resp.body._version) {
              msg.payload._version = resp.body._version; // Версия документа
            }

            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Get Node Error - ' + err);
            msg.payload = null; // Возвращаем null в случае ошибки
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Get Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Get Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-get', opensearchGetNode);
};

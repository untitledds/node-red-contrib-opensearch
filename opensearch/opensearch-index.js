module.exports = function (RED) {
  'use strict';

  function opensearchIndexNode(config) {
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
        const indexConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: msg.payload, // Тело документа из входящего сообщения
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          indexConfig.index = msg.index;
        }

        // Добавление ID документа
        if (config.esId) {
          indexConfig.id = config.esId; // Используем ID из конфигурации узла
        } else if (msg.esId) {
          indexConfig.id = msg.esId; // Используем ID из входящего сообщения
        } else if (msg.payload._id) {
          indexConfig.id = msg.payload._id; // Используем _id из тела документа
          delete msg.payload._id; // Удаляем _id из тела документа
        }

        // Добавление routing
        if (msg.routing) {
          indexConfig.routing = msg.routing;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .index(indexConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Index Error - ' + err);
            msg.payload = err; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Index Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Index Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-index', opensearchIndexNode);
};

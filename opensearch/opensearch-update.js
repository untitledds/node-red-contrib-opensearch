module.exports = function (RED) {
  'use strict';

  function opensearchUpdateNode(config) {
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
        const updateConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: msg.payload, // Тело запроса из входящего сообщения
          routing: config.routing, // Routing из конфигурации узла
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          updateConfig.index = msg.index;
        }

        // Переопределение ID документа из входящего сообщения
        if (msg.esId) {
          updateConfig.id = msg.esId;
        } else if (msg.payload?._id) {
          updateConfig.id = msg.payload._id; // Извлечение ID из тела сообщения
          delete msg.payload._id; // Удаление _id из тела сообщения
        }

        // Переопределение routing из входящего сообщения
        if (msg.routing) {
          updateConfig.routing = msg.routing;
        }

        // Проверка наличия ID документа
        if (!updateConfig.id) {
          node.status({
            fill: 'red',
            shape: 'dot',
            text: 'No document ID to update',
          });
          return;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .update(updateConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Update Node Error - ' + err);
            msg.payload = err; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Update Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Update Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-update', opensearchUpdateNode);
};

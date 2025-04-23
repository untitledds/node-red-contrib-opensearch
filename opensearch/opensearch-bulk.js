module.exports = function (RED) {
  'use strict';

  function opensearchBulkNode(config) {
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
        const bulkConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: [], // Тело bulk-запроса
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          bulkConfig.index = msg.index;
        }

        // Добавление ID документа (если указано)
        if (msg.id) {
          bulkConfig.id = msg.id;
        }

        // Обработка массива данных
        if (
          msg.payload &&
          Array.isArray(msg.payload) &&
          msg.payload.length > 0
        ) {
          for (const item of msg.payload) {
            processData(item, bulkConfig, node);
          }
        } else {
          node.error('Invalid payload: Expected an array of operations.');
          msg.payload = {
            error: 'Invalid payload: Expected an array of operations.',
          };
          node.send(msg);
          return;
        }

        // Выполнение bulk-запроса к OpenSearch
        serverConfig.client
          .bulk(bulkConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((error) => {
            node.error('OpenSearch Bulk Node Error - ' + error);
            msg.payload = error; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Bulk Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Bulk Node Error - ' + err);
    }
  }

  // Функция для обработки операций bulk
  function processData(current, bulkConfig, node) {
    try {
      let actionDescription = {},
        action = {};

      // Извлечение типа действия (например, 'index', 'update', 'delete')
      const actionType = current.meta?.action;
      if (!actionType) {
        throw new Error('Missing \'action\' in meta object');
      }
      delete current.meta.action;

      // Создание описания действия
      actionDescription[actionType] = current.meta;

      // Определение данных для действия
      switch (actionType) {
      case 'update':
        action = { doc: current.data }; // Для update используется поле 'doc'
        break;
      case 'delete':
        action = null; // Для delete данные не нужны
        break;
      default:
        action = current.data; // Для index/create данные передаются напрямую
      }

      // Добавление описания действия и данных в тело bulk-запроса
      if (actionDescription) {
        bulkConfig.body.push(actionDescription);
      }
      if (action !== undefined) {
        bulkConfig.body.push(action);
      }
    } catch (err) {
      node.error('Process Data Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-bulk', opensearchBulkNode);
};

module.exports = function (RED) {
  'use strict';

  function opensearchSearchNode(config) {
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
        const searchConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: config.query, // Запрос из конфигурации узла
          size: config.size, // Количество результатов
          from: config.from, // Смещение
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          searchConfig.index = msg.index;
        }

        // Переопределение запроса из входящего сообщения
        if (msg.query) {
          searchConfig.body = msg.query;
        }

        // Переопределение размера страницы
        if (msg.size) {
          searchConfig.size = msg.size;
        } else if (config.size) {
          searchConfig.size = config.size;
        } else {
          searchConfig.size = 10; // По умолчанию 10
        }

        // Переопределение смещения
        if (msg.from) {
          searchConfig.from = msg.from;
        }

        // Поддержка scroll
        if (config.scroll || msg.scroll) {
          searchConfig.scroll = '1m'; // Время жизни scroll-курсора
        }

        // Инициализация payload и es_responses
        msg.payload = [];
        if (config.fullResponse) {
          msg.es_responses = [];
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .search(searchConfig)
          .then((resp) => {
            (function next(resp) {
              // Добавление полного ответа, если требуется
              if (config.fullResponse) {
                msg.es_responses.push(resp);
              }

              // Проверка наличия результатов
              if (!resp.hits || !resp.hits.hits || !resp.hits.hits.length) {
                node.send(msg);
                return;
              }

              // Обработка найденных документов
              for (const hit of resp.hits.hits) {
                const obj = {
                  _source: hit._source,
                  _id: hit._id,
                };
                msg.payload.push(obj);

                // Отправка данных пакетами, если указан bulkSize
                if (
                  config.bulkSize &&
                  msg.payload.length % config.bulkSize === 0
                ) {
                  node.send(msg);
                  msg.payload = [];
                }
              }

              // Если scroll не используется, завершаем обработку
              if (!searchConfig.scroll) {
                node.send(msg);
                return;
              }

              // Продолжение scroll-запроса
              const scrollId = resp._scroll_id;
              serverConfig.client
                .scroll({
                  scroll: '1m',
                  scroll_id: scrollId,
                })
                .then(next)
                .catch((err) => node.error('Scroll error: ' + err));
            })(resp);
          })
          .catch((err) => {
            node.error('OpenSearch Search Node Error - ' + err.message);
            msg.payload = [];
            msg.error = err;
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Search Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Search Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-search', opensearchSearchNode);
};

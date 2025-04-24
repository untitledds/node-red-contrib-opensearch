module.exports = function (RED) {
  'use strict';

  function OpenSearchSearchNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const serverConfig = RED.nodes.getNode(config.server);

    if (!serverConfig || !serverConfig.client) {
      node.status({ fill: 'red', shape: 'dot', text: 'No OpenSearch client' });
      return;
    }

    node.on('input', function (msg, send, done) {
      try {
        // Подготовка конфигурации поиска
        const searchConfig = {
          index: msg.index || config.index,
          body: msg.query || config.query || { query: { match_all: {} } },
          size: msg.size || config.size || 10,
          from: msg.from || config.from || 0,
        };

        // Инициализация выходных данных
        msg.payload = [];
        if (config.fullResponse) {
          msg.es_responses = [];
        }

        // Обработка scroll-запросов
        if (config.scroll || msg.scroll) {
          searchConfig.scroll = '1m';
          processScrollSearch();
        } else {
          processNormalSearch();
        }

        function processNormalSearch() {
          serverConfig.client
            .search(searchConfig)
            .then((resp) => {
              processResponse(resp);
              if (done) done();
            })
            .catch((err) => handleError(err));
        }

        function processScrollSearch() {
          let scrollId = null;

          const processScrollResponse = (resp) => {
            processResponse(resp);
            scrollId = resp._scroll_id;

            if (resp.hits.hits.length === 0) {
              if (done) done();
              return Promise.resolve();
            }

            return serverConfig.client
              .scroll({
                scroll_id: scrollId,
                scroll: '1m',
              })
              .then(processScrollResponse);
          };

          serverConfig.client
            .search(searchConfig)
            .then(processScrollResponse)
            .catch((err) => handleError(err));
        }

        function processResponse(resp) {
          // Основная логика заполнения payload
          if (resp.hits?.hits) {
            const hitsData = resp.hits.hits.map((hit) => ({
              data: hit._source,
              meta: {
                id: hit._id,
                index: hit._index,
                score: hit._score,
              },
            }));

            if (config.bulkSize) {
              // Пакетная отправка
              msg.payload.push(...hitsData);
              if (msg.payload.length >= config.bulkSize) {
                send([msg, null]);
                msg.payload = [];
              }
            } else {
              // Полная отправка
              msg.payload = hitsData;
            }
          }

          // Сохранение полного ответа если нужно
          if (config.fullResponse) {
            if (!msg.es_responses) msg.es_responses = [];
            msg.es_responses.push(resp);
          }

          // Отправка при обычном поиске или последней партии scroll
          if (!config.scroll || resp.hits.hits.length === 0) {
            send([msg, null]);
          }
        }

        function handleError(err) {
          node.error('Search error: ' + err.message, msg);
          msg.error = err;
          msg.payload = [];
          send([null, msg]);
          if (done) done();
        }
      } catch (err) {
        if (done) done(err);
        else node.error(err, msg);
      }
    });

    node.on('close', function (done) {
      done();
    });
  }

  RED.nodes.registerType('opensearch-search', OpenSearchSearchNode, {
    defaults: {
      name: { value: '' },
      server: { value: '' },
      index: { value: '' },
      query: { value: '' },
      size: { value: 10 },
      from: { value: 0 },
      scroll: { value: false },
      bulkSize: { value: 0 },
      fullResponse: { value: false },
    },
  });
};

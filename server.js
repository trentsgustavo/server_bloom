const port = 3000;
const bodyParser = require('body-parser');
const app = require('express')();
const http = require('http').createServer(app);
const { Client } = require('pg')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const client = new Client({
    user: 'USER',
    host: 'IP',
    database: 'DATABASE',
    password: 'DATABASE_PASSWORD',
    port: 'DATABASE_PORT',
});

client.connect();

http.listen(process.env.PORT || port, function () {
    console.log(`Server running at port 3000`);
});

app.get('/getAtual', function (req, res) {
    client.query('SELECT id, nome FROM plantas WHERE atual is true') // your query string here
        .then((result) => { res.json(result.rows[0]); }) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/updateHistory', function (req, res) {
    client.query("INSERT INTO historico (luminosidade, umidade, temperatura, update_at, planta_id) values ($2, $3, $4, now() - INTERVAL '1 HOUR', $1) RETURNING id", [req.body.id, req.body.luminosidade, req.body.umidade, req.body.temperatura])
        .then((result) => { res.end('registro inserido com sucesso: ' + result.rows[0].id); })
        .catch(e => console.error(e.stack))
});

app.post('/updateAtual', function (req, res) {
    res.end(updateAtual(req.body.id));
});

app.get('/getSpecies', function (req, res) {
    client.query('SELECT id::text, nome FROM especies ORDER BY nome') // your query string here
        .then((result) => { res.json(result.rows); console.log(result.rows) }) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/getSpecie', function (req, res) {
    client.query('SELECT * FROM especies WHERE id = $1;', [req.body.id]) // your query string here
        .then((result) => {res.json(result.rows[0]);}) // your callback here
        .catch(e => console.error(e.stack))
});

app.get('/getTrees', function (req, res) {
    client.query('SELECT p.id::text, p.nome, p.nascimento, e.nome as especie FROM plantas AS p INNER JOIN especies AS e ON (p.especie_id = e.id) ORDER BY p.id') // your query string here
        .then((result) => { res.json(result.rows); }) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/saveTree', function (req, res) {
    console.log(req.body);
    client.query('INSERT INTO plantas (nome, nascimento, especie_id) VALUES ($1, $2, $3) RETURNING id', [req.body.nome, req.body.nascimento, req.body.especie]) // your query string here
        .then(result => updateAtual(result.id)) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/updateSpecie', function (req, res) {
    console.log(req.body);
    client.query('UPDATE especies SET nome = $1, umidade= $2, luminosidade = $3, temp_min = $4, temp_max = $5 WHERE id = $6', [req.body.nome, req.body.umidade, req.body.luminosidade, req.body.temp_min, req.body.temp_max, req.body.id]) // your query string here
        .then(result => res.end('Espécie atualizada com sucesso')) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/saveSpecie', function (req, res) {
    client.query('INSERT INTO especies (nome, umidade, luminosidade, temp_min, temp_max) VALUES ($1, $2, $3, $4, $5)', [req.body.nome, req.body.umidade, req.body.luminosidade, req.body.temp_min, req.body.temp_max]) // your query string here
        .then(result => res.end('Espécie cadastrada com sucesso')) // your callback here
        .catch(e => console.error(e.stack))
});

app.post('/getGraph', function (req, res) {
    client.query(getQueryGraph(req.body.time))
        .then(result => {
            res.json(result.rows);
            console.log(result.rows);
        })
        .catch(e => console.error(e.stack))
});

app.post('/getHistoric', async function (req, res) {
    var media = await queryMedia(req.body.planta_id, getPeriod(req.body.time));
    var especie = await querySpecie();
    console.log(especie.umidade_i, especie.luminosidade_i);

    var retorno = {
        umidade: {
            valor: Math.round(media.umidade * 100) / 100,
            status: umidadeIdeal(especie.luminosidade_i, media.umidade)
        },
        luminosidade: {
            valor: Math.round(media.luminosidade * 100) / 100,
            status: luminosidadeIdeal(especie.umidade_i, media.luminosidade)
        },
        temperatura: {
            valor: Math.round(media.temperatura * 100) / 100,
            status: temperaturaIdeal(especie.temp_min_i, especie.temp_max_i, media.temperatura)
        }
    }

    res.json(retorno);
});

function updateAtual(id) {
    let retorno = '';
    client.query('UPDATE plantas SET atual = FALSE') // your query string here
        .then(() => {
            client.query('UPDATE plantas SET atual = TRUE WHERE id = $1', [id])
                .then(retorno = 'Sua planta favorita foi escolhida')
                .catch(err => retorno = err.stack)
        })
        .catch(err => retorno = err.stack)
    return retorno;
}

function getPeriod(time) {
    switch (time) {
        case 's':
            return '1 WEEK';
        case 'm':
            return '1 MONTH';
        default:
            return '1 DAY';
    }
}

function getMultiplier(time) {
    switch (time) {
        case 's':
            return 7;
        case 'm':
            return 30;
        default:
            return 1;
    }
}

async function querySpecie() {
    try {
        var retorno = await client.query("SELECT E.luminosidade as luminosidade_i, E.umidade as umidade_i, E.temp_min as temp_min_i, E.temp_max as temp_max_i FROM especies as E INNER JOIN plantas as P on (P.especie_id = E.id) WHERE p.atual is true");
        return retorno.rows[0];
    } catch (e) {
        console.log(e.stack)
    }
}

async function queryMedia(planta_id, time) {
    try {
        var retorno = await client.query("SELECT AVG(umidade) AS umidade, AVG(luminosidade) AS luminosidade, AVG(temperatura) AS temperatura  FROM historico WHERE planta_id = $1 AND update_at BETWEEN NOW() - INTERVAL '" + time + "' AND NOW();", [planta_id]);
        return calculateMedia(retorno.rows[0]);
    } catch (e) {
        console.log(e.stack);
    }
}

function calculateMedia(rows) {
    return { umidade: rows.umidade, luminosidade: rows.luminosidade, temperatura: rows.temperatura };
}

function umidadeIdeal(ideal, media) {
    if (media < (ideal - 1)) {
        return 'down';
    } else if (media > (ideal + 1)) {
        return 'up';
    } else {
        return 'check';
    }
}

function luminosidadeIdeal(ideal, media) {
    if (media < (ideal - 1)) {
        return 'down';
    } else if (media > (ideal + 1)) {
        return 'up';
    } else {
        return 'check';
    }
}

function temperaturaIdeal(temp_min, temp_max, media) {
    if (temp_min > media) {
        return 'down';
    } else if (temp_max < media) {
        return 'up';
    } else {
        return 'check';
    }
}

function getQueryGraph(time) {
    if (time == 'd') {
        return "SELECT AVG(umidade) AS umidade, AVG(luminosidade) as luminosidade, AVG(temperatura) as temperatura, date_trunc('hour', update_at) as date FROM historico WHERE update_at BETWEEN NOW() - INTERVAL '24 HOURS' AND NOW() GROUP BY date_trunc('hour', update_at) ORDER BY date";
    } else {
        return "SELECT AVG(umidade) AS umidade, AVG(luminosidade) as luminosidade, AVG(temperatura) as temperatura, DATE(update_at) FROM historico WHERE update_at BETWEEN NOW() - INTERVAL '" + getPeriod(time) + "' AND NOW() group by DATE(update_at) ORDER BY DATE(update_at);"
    }
}

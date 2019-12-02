const port = 3000;
const bodyParser = require('body-parser');
const app = require('express')();
const http = require('http').createServer(app);
const { Client } = require('pg')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'postgres',
    port: 5432,
});

client.connect();

http.listen(process.env.PORT || port, function(){
	  console.log(`Server running at port 3000`);
});

app.get('/getAtual', function(req, res){
	client.query('SELECT * FROM plantas WHERE atual is true') // your query string here
		  .then( (result) =>{ res.json(result.rows[0]); console.log(result.rows);}) // your callback here
          .catch(e => console.error(e.stack))
});

app.post('/updateHistory', function(req, res){
	client.query('INSERT historico SET luminosidade = $2, umidade = $3, temperatura = $4, update_at = now() WHERE planta_id = $1', [req.body.id, req.body.luminosidade, req.body.umidade, req.body.temperatura]) // your query string here
		  .then( (result) =>{ res.json(result.rows[0]); console.log(result.rows);}) // your callback here
          .catch(e => console.error(e.stack))
});

app.post('/updateAtual', function(req, res){
    console.log('updateAtual', req.body);
	client.query('UPDATE plantas SET atual = FALSE') // your query string here
		  .then( () => { 
            client.query('UPDATE plantas SET atual = TRUE WHERE id = $1', [req.body.id])
            .then(result => res.end('Sua planta favorita foi escolhida'))
            .catch(err => console.error(err.stack))
            }) // your callback here
          .catch(e => console.error(e.stack))
});

app.get('/getSpecies', function(req, res){
	client.query('SELECT id::text, nome FROM especies ORDER BY nome') // your query string here
		  .then( (result) =>{ res.json(result.rows); console.log(result.rows);}) // your callback here
          .catch(e => console.error(e.stack))
});

app.get('/getTrees', function(req, res){
	client.query('SELECT p.id::text, p.nome, p.nascimento, e.nome as especie FROM plantas AS p INNER JOIN especies AS e ON (p.especie_id = e.id) ORDER BY p.id') // your query string here
		  .then( (result) =>{ res.json(result.rows); console.log(result.rows);}) // your callback here
          .catch(e => console.error(e.stack))
});

app.post('/saveTree', function(req, res){
	console.log(req.body);
	client.query('INSERT INTO plantas (nome, nascimento, especie_id) VALUES ($1, $2, $3)', [req.body.nome, req.body.nascimento, req.body.especie]) // your query string here
          .then(result => res.end('Planta cadastrada com sucesso')) // your callback here
          .catch(e => console.error(e.stack))
});

app.post('/saveSpecie', function(req, res){
	console.log(req.body);
	client.query('INSERT INTO especies (nome, umidade, luminosidade, temp_min, temp_max) VALUES ($1, $2, $3, $4, $5)', [req.body.nome, req.body.umidade, req.body.luminosidade, req.body.temp_min, req.body.temp_max]) // your query string here
          .then(result => res.end('Espécie cadastrada com sucesso')) // your callback here
          .catch(e => console.error(e.stack))
});
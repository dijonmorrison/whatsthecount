// Include the cluster module
var cluster = require('cluster');
const { nextTick } = require('process');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function (worker) {

        // Replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

// Code to run if we're in a worker process
} else {
    var AWS = require('aws-sdk');
    var express = require('express');
    var bodyParser = require('body-parser');
    var mysql = require('mysql');

    var db = mysql.createConnection({
        host     : process.env.RDS_HOSTNAME,
        user     : process.env.RDS_USERNAME,
        password : process.env.RDS_PASSWORD,
        port     : process.env.RDS_PORT,
        database : 'ripperDB'
      });
      
    db.connect(function(err) {
      if (err) {
        console.error('Database connection failed: ' + err.stack);
      return;
      }
      
        console.log('Connected to database.');
      });
      

    AWS.config.region = process.env.REGION

    var sns = new AWS.SNS();
    var ddb = new AWS.DynamoDB();
    //var ddbDocumentClient = new AWS.DynamoDB.DocumentClient();

    var ddbTable =  process.env.STARTUP_SIGNUP_TABLE;
    var snsTopic =  process.env.NEW_SIGNUP_TOPIC;
    var app = express();

    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');
    app.use(bodyParser.urlencoded({extended:false}));

    app.get('/', function(req, res, next) {
        var sql = 'SELECT * FROM rips WHERE rip_time = (SELECT MAX(rip_time) FROM rips)';
        
        db.query(sql, function (err, data, fields){
            if (err) throw err;    
            console.log(data[0].rip_number);         
        res.render('index', {
            ripData    : data[0].rip_number,
            static_path: 'static',
            theme: process.env.THEME ,
            flask_debug: process.env.FLASK_DEBUG || 'false'
        });
      });
    });
    /*
    app.get('/riplog', function(req, res, next) {
        var sql = 'SELECT * FROM rips WHERE rip_time = (SELECT MAX(rip_time) FROM rips)';
        
        db.query(sql, function (err, data, fields){
            if (err) throw err;    
            console.log(data[0].rip_number);         
        res.render('riplog', {
            ripData    : data[0].rip_number,
            static_path: 'static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false'
        });
      });
    });
    */

    app.get('/createdb',(req, res)=>{
        let sql = "CREATE DATABASE ripperDB";

        db.query(sql, (err) => {

            if (err) {
              throw err;     
            }
            res.send("Database created");   
          });
        
        });

    app.get('/createRipTable',(req,res)=>{
        let sql = "CREATE TABLE rips (id int AUTO_INCREMENT PRIMARY KEY, rip_number int, comment VARCHAR(240), rip_time DATETIME)";

        db.query(sql, (err) => {

            if (err) {
        
              throw err;
        
            }
        
            res.send("rip Table created");
        
          });
        });

    app.get('/createRipCount',(req,res)=>{
      let sql = "CREATE TABLE ripCount ("
    } )
    
    app.get('/queryTable',(req,res)=>{
        let sql = "SELECT * FROM rips"

        db.query(sql, function(err, result, fields){

            if (err) {
                  throw err; 
            }
            res.send(result);        
          });
        });
    

    app.get('/insertRip',(req,res)=>{
        let post = {rip_number: 321, comment: "First rip in the DB", rip_time: "2022-05-24 00:00:00"};

        let sql = "INSERT INTO rips SET ?";
    
        db.query(sql, post, (err) => {
    
        if (err) {        
            throw err;
          }           
                       
            });
        });

    app.get('/deleteRips',(req,res)=>{

        let sql = "DELETE FROM rips;";
    
        db.query(sql, (err) => {
    
        if (err) {        
            throw err;
          }           
        res.send("Rips deleted");            
            });
        });

  
    app.post('/signup', function(req, res) {

        var creds = req.body.creds;
        
        var item = {
            'rip_number': req.body.rip_number,
            'comment': req.body.comment,
            'rip_time': new Date().toISOString().slice(0, 19).replace('T', ' ')
        };

        let sql = "INSERT INTO rips SET ?";
        
        if(authenticate(creds)){
          db.query(sql, item, (err) => {  
            if (err) {     
              console.log(err)   
              throw err;
            }  
          res.send({creds: 'valid'}); 
          });
        }else{
          res.send({creds: 'invalid'});
        }
    });

    var port = process.env.PORT || 3000;

    var server = app.listen(port, function () {
        console.log('Server running at http://127.0.0.1:' + port + '/');
    });

    function authenticate(creds){

      let validCreds = ['2690', '6318'];

      let authUser = false;

      if (validCreds.includes(creds)){
        authUser = true;
      }
      
      console.log('authUser:' + authUser)
      return authUser;
    }


}


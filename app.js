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
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false'
        });
      });
    });

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

    app.get('/insertRip',(req,res)=>{
        let post = {rip_number: 321, comment: "First rip in the DB", rip_time: "2022-05-24 00:00:00"};

        let sql = "INSERT INTO rips SET ?";
    
        db.query(sql, post, (err) => {
    
        if (err) {
            
            throw err;
            
            }
            
            res.send("rip inserted");
            
            });
        });

  
    app.post('/signup', function(req, res) {
        var item = {
            'email': {'S': req.body.email},
            'name': {'S': req.body.name},
            'preview': {'S': req.body.previewAccess},
            'theme': {'S': req.body.theme}
        };

        ddb.putItem({
            'TableName': ddbTable,
            'Item': item,
            'Expected': { email: { Exists: false } }        
        }, function(err, data) {
            if (err) {
                var returnStatus = 500;

                if (err.code === 'ConditionalCheckFailedException') {
                    returnStatus = 409;
                }

                res.status(returnStatus).end();
                console.log('DDB Error: ' + err);
            } else {
                sns.publish({
                    'Message': 'Name: ' + req.body.name + "\r\nEmail: " + req.body.email 
                                        + "\r\nPreviewAccess: " + req.body.previewAccess 
                                        + "\r\nTheme: " + req.body.theme,
                    'Subject': 'New user sign up!!!',
                    'TopicArn': snsTopic
                }, function(err, data) {
                    if (err) {
                        res.status(500).end();
                        console.log('SNS Error: ' + err);
                    } else {
                        res.status(201).end();
                    }
                });            
            }
        });
    });

    var port = process.env.PORT || 3000;

    var server = app.listen(port, function () {
        console.log('Server running at http://127.0.0.1:' + port + '/');
    });
}


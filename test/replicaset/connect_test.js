var testCase = require('../../deps/nodeunit').testCase,
  debug = require('util').debug
  inspect = require('util').inspect,
  ReplicaSetManager = require('../tools/replica_set_manager').ReplicaSetManager,
  Db = require('../../lib/mongodb').Db,
  ReplSetServers = require('../../lib/mongodb').ReplSetServers,
  Server = require('../../lib/mongodb').Server;

// Keep instance of ReplicaSetManager
var serversUp = false;

var ensureConnection = function(test, numberOfTries, callback) {
  // Replica configuration
  var replSet = new ReplSetServers( [ 
      new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
      new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
      new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
    ], 
    {rs_name:RS.name}
  );
  
  if(numberOfTries <= 0) return callback(new Error("could not connect correctly"), null);

  var db = new Db('integration_test_', replSet);
  db.open(function(err, p_db) {
    if(err != null) {
      db.close();
      // Wait for a sec and retry
      setTimeout(function() {
        numberOfTries = numberOfTries - 1;
        ensureConnection(test, numberOfTries, callback);
      }, 1000);
    } else {
      return callback(null, p_db);
    }    
  })            
}

module.exports = testCase({
  setUp: function(callback) {
    // Create instance of replicaset manager but only for the first call
    if(!serversUp) {
      serversUp = true;
      RS = new ReplicaSetManager();
      RS.startSet(function(err, result) {      
        callback();      
      });      
    } else {
      RS.restartKilledNodes(function(err, result) {
        callback();        
      })
    }
  },
  
  tearDown: function(callback) {
    RS.restartKilledNodes(function(err, result) {
      callback();        
    })
  },
  
  shouldConnectWithPrimarySteppedDown : function(test) {
    // debug("=========================================== shouldConnectWithPrimarySteppedDown")
    // Step down primary server
    RS.stepDownPrimary(function(err, result) {
      // Wait for new primary to pop up
      ensureConnection(test, 60, function(err, p_db) {
        test.ok(err == null);
        test.equal(true, p_db.serverConfig.isConnected());
        
        p_db.close();
        test.done();          
      });        
    });
  },
  
  shouldConnectWithThirdNodeKilled : function(test) {
    // debug("=========================================== shouldConnectWithThirdNodeKilled")
    RS.getNodeFromPort(RS.ports[2], function(err, node) {
      RS.kill(node, function(err, result) {
        // Replica configuration
        var replSet = new ReplSetServers( [ 
            new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
            new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
            new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
          ], 
          {rs_name:RS.name}
        );
    
        // Wait for new primary to pop up
        ensureConnection(test, 60, function(err, p_db) {
          test.ok(err == null);
          test.equal(true, p_db.serverConfig.isConnected());
  
          p_db.close();
          test.done();          
        });        
      });      
    });
  },
  
  shouldConnectWithSecondaryNodeKilled : function(test) {
    // debug("=========================================== shouldConnectWithSecondaryNodeKilled")
    RS.killSecondary(function(node) {
      // Replica configuration
      var replSet = new ReplSetServers( [ 
          new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
          new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
          new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
        ], 
        {rs_name:RS.name}
      );
  
      var db = new Db('integration_test_', replSet);
      db.open(function(err, p_db) {
        test.ok(err == null);
        test.equal(true, p_db.serverConfig.isConnected());
  
        // Close and cleanup
        db.close();        
        test.done();          
      })                  
    });
  },
  
  shouldConnectWithPrimaryNodeKilled : function(test) {
    // debug("=========================================== shouldConnectWithPrimaryNodeKilled")
    RS.killPrimary(function(node) {
      // Replica configuration
      var replSet = new ReplSetServers( [ 
          new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
          new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
          new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
        ], 
        {rs_name:RS.name}
      );
    
      var db = new Db('integration_test_', replSet);
      db.open(function(err, p_db) {
        test.ok(err != null);
        test.equal("No master available", err.message);
        db.close();
        
        ensureConnection(test, 60, function(err, p_db) {
          test.ok(err == null);
          test.equal(true, p_db.serverConfig.isConnected());
          
          p_db.close();
          test.done();          
        });        
      })            
    });    
  },
  
  shouldCorrectlyBeAbleToUsePortAccessors : function(test) {
    // debug("=========================================== shouldCorrectlyBeAbleToUsePortAccessors")
    // Replica configuration
    var replSet = new ReplSetServers( [ 
        new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
      ], 
      {rs_name:RS.name}
    );
  
    var db = new Db('integration_test_', replSet);
    db.open(function(err, p_db) {
      test.equal(replSet.host, p_db.serverConfig.primary.host);
      test.equal(replSet.port, p_db.serverConfig.primary.port);
      
      db.close();
      test.done();
    })            
  },
    
  shouldCorrectlyConnect: function(test) {
    // debug("=========================================== shouldCorrectlyConnect")
    // Replica configuration
    var replSet = new ReplSetServers( [ 
        new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
      ], 
      {rs_name:RS.name}
    );
  
    var db = new Db('integration_test_', replSet );
    db.open(function(err, p_db) {
      test.equal(true, p_db.serverConfig.isConnected());
      
      // Test primary
      RS.primary(function(err, primary) {
        test.notEqual(null, primary);                
        test.equal(primary, p_db.serverConfig.primary.host + ":" + p_db.serverConfig.primary.port);
  
        // Perform tests
        RS.secondaries(function(err, items) {
          // Test if we have the right secondaries
          test.deepEqual(items.sort(), p_db.serverConfig.secondaries.map(function(item) {
                                          return item.host + ":" + item.port;
                                        }).sort());
  
          // Test if we have the right arbiters
          RS.arbiters(function(err, items) {
            test.deepEqual(items.sort(), p_db.serverConfig.arbiters.map(function(item) {
                                            return item.host + ":" + item.port;
                                          }).sort());
  
            // Force new instance 
            var db2 = new Db('integration_test_', replSet );
            db2.open(function(err, p_db2) {
              test.equal(true, p_db2.serverConfig.isConnected());
  
              // Close top instance
              db.close();
              db2.close();
              test.done();
            });            
          });
        });
      })            
    });        
  },
  
  shouldCorrectlyPassErrorWhenWrongReplicaSet : function(test) {
    // debug("=========================================== shouldCorrectlyHandleBadName")
    // Replica configuration
    var replSet = new ReplSetServers([ 
        new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
        new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
      ], 
      {rs_name:RS.name + "-wrong"}
    );

    // test.done();
  
    var db = new Db('integration_test_', replSet);
    db.open(function(err, p_db) {
      test.notEqual(null, err);
      test.done();
    })    
  },  
})
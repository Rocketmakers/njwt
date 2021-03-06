var assert = require('chai').assert;

var nJwt = require('../');

var uuid = require('uuid');

var properties = require('../properties.json');

describe('Verifier',function(){
  it('should construct itself if called without new',function(){
    assert(nJwt.Verifier() instanceof nJwt.Verifier);
  });
});

describe('Verifier().setSigningAlgorithm() ',function(){
  describe('if called with an unsupported algorithm',function(){

    it('should throw UNSUPPORTED_SIGNING_ALG',function(){
      assert.throws(function(){
        new nJwt.Verifier().setSigningAlgorithm('unsupported');
      },properties.errors.UNSUPPORTED_SIGNING_ALG);
    });

  });
});

describe('.verify()',function(){

  it('should persist the original token to the toString() invocation',function(){
    var token = new nJwt.Jwt({hello: uuid()}).setSigningAlgorithm('none').compact();
    assert.equal(token,nJwt.verify(token).toString());
  });

  describe('if given only a token',function(){
    it('should verify tokens that are alg none',function(){
      var claims = {hello: uuid()};
      var token = new nJwt.Jwt(claims)
        .setSigningAlgorithm('none')
        .compact();
      assert.doesNotThrow(function(){
        nJwt.verify(token);
      });
    });
    it('should reject tokens that specify an alg',function(){
      var claims = {hello: uuid()};
      var key = uuid();
      var token = new nJwt.create(claims,key)
        .compact();
      assert.throws(function(){
        nJwt.verify(token);
      },properties.errors.SIGNATURE_ALGORITHM_MISMTACH);
    });
  });

  it('should return PARSE_ERROR if the header is not JSON',function(){
    assert.throws(function(){
      nJwt.verify("noavalidheader.notavalidbody");
    },properties.errors.PARSE_ERROR);
  });

  it('should give me the original string on the parse error object',function(done){
    var invalidJwt = 'noavalidheader.notavalidbody';
    nJwt.verify(invalidJwt,function(err){
      assert.equal(err.jwtString, invalidJwt);
      done();
    });
  });

  it('should return PARSE_ERROR if the body is not JSON',function(){
    var header = nJwt.JwtHeader({type:'JWT',alg:'HS256'}).compact();
    assert.throws(function(){
      nJwt.verify(header+".notavalidbody");
    },properties.errors.PARSE_ERROR);
  });

  it('should give me the parsed header on the error object if the body fails',function(done){
    var header = nJwt.JwtHeader({typ:'JWT',alg:uuid()});
    var invalidJwt = header.compact()+'.notavalidbody';
    nJwt.verify(invalidJwt,function(err){
      assert.equal(err.jwtString, invalidJwt);
      assert.equal(err.parsedHeader.alg, header.alg);
      done();
    });
  });

});

describe('Verifier().verify() ',function(){

  it('should support sync usage',function(){
    var verifier = new nJwt.Verifier()
      .setSigningAlgorithm('none');
    var claims = {hello: uuid()};
    var token = new nJwt.Jwt(claims).compact();
    var verifiedToken;
    assert.doesNotThrow(function(){
      verifiedToken = verifier.verify(token);
    });

    assert(verifiedToken instanceof nJwt.Jwt);
    assert.equal(verifiedToken.body.hello,claims.hello);

    assert.throws(function(){
      verifiedToken = verifier.verify('invalid token');
    },properties.errors.PARSE_ERROR);

  });

  it('should return the jwt string, header and body on error objects',function(done){
    var jwt = new nJwt.Jwt({expiredToken:uuid()})
      .setExpiration(new Date().getTime()-1000);
    var token = jwt.compact();
    nJwt.verify(token,function(err){
      assert.equal(err.jwtString,token);
      assert.equal(err.parsedHeader.alg,jwt.header.alg);
      assert.equal(err.parsedBody.expiredToken,jwt.body.expiredToken);
      assert.equal(err.userMessage,properties.errors.EXPIRED);
      done();
    });
  });

  describe('when configured to expect no verification',function(){

    var verifier = new nJwt.Verifier()
      .setSigningAlgorithm('none');

    var claims = {hello: uuid()};

    describe('and given an unsigned token',function(){

      var result;
      var token = new nJwt.Jwt(claims).compact();

      before(function(done){
        verifier.verify(token,function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return the JWT object',function(){
        assert.isNull(result[0],'An unexpcted error was returned');
        assert.equal(result[1].body.hello,claims.hello);
      });
    });

    describe('and given an expired token',function(){

      var result;
      var jwt = new nJwt.Jwt({expiredToken:'x'})
        .setExpiration(new Date().getTime()-1000);


      before(function(done){
        debugger
        verifier.verify(jwt.compact(),function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return EXPIRED',function(){
        assert.isNotNull(result[0],'An error was not returned');
        assert.equal(result[0].userMessage,properties.errors.EXPIRED);
      });
    });

    describe('and given an signed token',function(){

      var result;
      var token = new nJwt.Jwt({foo:'bar'})
        .setSigningAlgorithm('HS256')
        .setSigningKey('foo')
        .compact();

      before(function(done){
        verifier.verify(token,function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return an unexpected algorithm error',function(){
        assert.isNotNull(result[0],'An error was not returned');
        assert.equal(result[0].userMessage,properties.errors.SIGNATURE_ALGORITHM_MISMTACH);
      });
    });

  });


  describe('when configured to expect signature verification',function(){

    var verifier = new nJwt.Verifier()
      .setSigningAlgorithm('HS256')
      .setSigningKey('hello');

    describe('and given an unsigned token',function(){

      var result;
      var token = new nJwt.Jwt({foo:'bar'}).compact();

      before(function(done){
        verifier.verify(token,function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return SIGNATURE_ALGORITHM_MISMTACH',function(){
        assert.isNotNull(result[0],'An error was not returned');
        assert.equal(result[0].userMessage,properties.errors.SIGNATURE_ALGORITHM_MISMTACH);
      });
    });

  });

  describe('when configured to expect signature verification',function(){

    var key = uuid.v4();

    var verifier = new nJwt.Verifier()
      .setSigningAlgorithm('HS256')
      .setSigningKey(key);

    var claims = {hello:uuid()};

    describe('and given a token that was signed with the same key',function(){

      var result;
      var token = new nJwt.Jwt(claims)
        .setSigningAlgorithm('HS256')
        .setSigningKey(key)
        .compact();

      before(function(done){
        verifier.verify(token,function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return the JWT object',function(){
        assert.isNull(result[0],'An unexpcted error was returned');
        assert.equal(result[1].body.hello,claims.hello);
      });
    });

    describe('and given a token that was signed with a different key',function(){

      var result;
      var token = new nJwt.Jwt(claims)
        .setSigningAlgorithm('HS256')
        .setSigningKey('not the same key')
        .compact();

      before(function(done){
        verifier.verify(token,function(err,res){
          result = [err,res];
          done();
        });
      });

      it('should return SIGNATURE_MISMTACH',function(){
        assert.isNotNull(result[0],'An error was not returned');
        assert.equal(result[0].userMessage,properties.errors.SIGNATURE_MISMTACH);
      });
    });

  });


});




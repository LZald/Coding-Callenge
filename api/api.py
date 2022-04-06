from flask import Flask, request, abort, Response
from pymongo import MongoClient
from flask_cors import CORS
from hashlib import md5
from bson.json_util import dumps
from bson.objectid import ObjectId
import jwt

app = Flask(__name__)

secretPw = '8yDrS6KnP%CzrP24m]x+4EDD)_^-^_vBY_a6{t/"@z=q!-e2^5'

CORS(app)

client = MongoClient('mongodb://root:example@mongo:27017/?readPreference=primary&appname=MongoDB+Compass&ssl=false')
db = client.bikeService

def check_token(f):
    def decorated(*args, **kargs):
        try:
            if (request.json['user'] == jwt.decode(request.headers['Authorization'], secretPw, algorithms='HS256')['id']):
                return f(*args, **kargs)
            abort(401)
        except Exception:
            abort(401)
    decorated.__name__ = f.__name__
    return decorated


@app.route("/", methods=['GET'])
def root():
    return Response(dumps('Bike Service Api'),  mimetype='application/json', status=200)

@app.route("/users")
def getUsers():
    return Response(dumps(getListOf('users')),  mimetype='application/json', status=200)

@app.route("/bikes")
def getBikes():
    return Response(dumps(getListOf('bikes')),  mimetype='application/json', status=200)

@app.route("/user/<string:id>")
def getUserById(id):
    return Response(dumps(getDocumentById('users', id)),  mimetype='application/json', status=200)

@app.route("/bike/<string:id>")
def getBikeById(id):
    return Response(dumps(getDocumentById('bikes', id)),  mimetype='application/json', status=200)

@app.route("/register", methods=['POST'])
def registerUser():
    if 'name' in request.json and 'passwd' in request.json:
        uname = request.json['name']
        pword = request.json['passwd']
    else:
        return Response(dumps('Missing info'),  mimetype='application/json', status=400)
    user =  {
        "name": uname,
        "pass": md5(str(pword).encode()).hexdigest(),
        "rented": None
    }
    if db.users.find_one({'name': request.json['name']}, {}) != None: return Response(dumps('User already exists'),  mimetype='application/json', status=400)
    db.users.insert_one(user)
    user.pop('pass')
    user['token'] = jwt.encode({'id': str(user['_id'])}, secretPw, algorithm='HS256')
    return Response(dumps(user),  mimetype='application/json', status=201)


@app.route('/login', methods=['POST'])
def login():
    if 'name' in request.json and 'passwd' in request.json:
        uname = request.json['name']
        pword = request.json['passwd']
    else:
        return Response(dumps('Missing info'),  mimetype='application/json', status=400)
    u = db.users.find_one({'name': uname, 'pass': md5(str(pword).encode()).hexdigest()}, {})
    if u is None:
        return Response(dumps("User or password incorrect"),  mimetype='application/json', status=404)
    u.pop('pass')
    u['token'] = jwt.encode({'id': str(u['_id'])}, secretPw, algorithm='HS256')
    return Response(dumps(u), mimetype='application/json', status=201)

@app.route('/rent', methods=['POST'])
@check_token
def rent():
    if 'bike' in request.json and 'user' in request.json:
        bikeId = request.json['bike']
        userId = request.json['user']
    else:
        return Response(dumps('Missing info'), mimetype='application/json', status=400)
    user = getDocumentById('users', userId)
    bike = getDocumentById('bikes', bikeId)
    if user is None or bike is None:
        return Response(dumps("User or Bike doesn't exist"), mimetype='application/json', status=404)
    if user['rented'] is not None or bike['rented'] is not None:
        return Response(dumps('User or Bike already rented'), mimetype='application/json', status=403)
    user['rented'] = ObjectId(bikeId)
    bike['rented'] = ObjectId(userId)
    db.users.update_one({'_id': ObjectId(userId)}, {'$set': user})
    db.bikes.update_one({'_id': ObjectId(bikeId)}, {'$set': bike})
    return Response(dumps('Rent successful'), mimetype='application/json', status=200)

@app.route('/unrent', methods=['POST'])
@check_token
def unRent():
    if 'bike' in request.json and 'user' in request.json:
        bikeId = request.json['bike']
        userId = request.json['user']
    else:
        return Response(dumps('Missing info'), mimetype='application/json', status=400)
    user = getDocumentById('users', userId)
    bike = getDocumentById('bikes', bikeId)
    if user is None or bike is None:
        return Response(dumps("User or Bike doesn't exist"), mimetype='application/json', status=404)
    if str(user['rented']) != bikeId or str(bike['rented']) != userId:
        return Response(dumps("User didn't rent this bike"), mimetype='application/json', status=403)
    user['rented'] = None
    bike['rented'] = None
    db.users.update_one({'_id': ObjectId(userId)}, {'$set': user})
    db.bikes.update_one({'_id': ObjectId(bikeId)}, {'$set': bike})
    return Response(dumps('return successful'), mimetype='application/json', status=200)

#-------------------------------------- Functions --------------------------------------#

def getDocumentById(collection, id):
    return db[collection].find_one({'_id': ObjectId(id)}, {})

def getListOf(collection):
    return [p for p in db[collection].find()]



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)

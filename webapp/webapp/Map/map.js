var map;
var redIcon, grayIcon, userIcon;
var bikes;
var user;

var lastMarker = false;
var rentedMarker = false;
var userMarker = false;

const userPos = { lat: 50.110924, lng: 8.642127};
const zoom0 = 14;
const zoom1 = 15;

const BASE_PATH = 'http://localhost:9080/'

//----------------------------------------------- Starts -----------------------------------------------//

function initMap() {
    user = localStorage.getItem('user');
    if (user === null) window.location.href = "../index.html";
    user = JSON.parse(user);

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: zoom0,
        center: userPos,
    });

    startIcons();
    startMarkers();
}

function startIcons(){
    redIcon = {
        url: "imgs/red.png", // url
        scaledSize: new google.maps.Size(25, 40), // scaled size
    };
    userIcon = {
        url: "imgs/user.png", // url
        scaledSize: new google.maps.Size(27, 35), // scaled size
    };
    grayIcon = {
        url: "imgs/gray.png", // url
        scaledSize: new google.maps.Size(25, 40), // scaled size
    };
}

function startMarkers(){
    function aux(data){
        bikes = data;
        bikes.forEach(bike => {
            newBikeMarker(bike);
        });
        startUser();
    }
    getApi(aux, 'bikes');
}

function startUser(){
    const infowindow = new google.maps.InfoWindow({
        content: userInfoWindow(),
        minWidth: 370,
        maxWidth: 340,
    });
    const marker = new google.maps.Marker({
        position: userPos,
        map,
        icon: userIcon,
        infowindow: infowindow,
        animation: google.maps.Animation.DROP,
        title: "You"
    });
    marker.addListener("click", () => {
        map.setZoom(zoom1);
        map.setCenter(marker.getPosition());
        infowindow.open({
            anchor: marker,
            map,
            shouldFocus: false,
        });
    });
    userMarker = marker;
}

//----------------------------------------------- API Functions -----------------------------------------------//

function postApi(fun, url, json){
    if(user['token'] == null){
        localStorage.clear();
        window.location.href = "../index.html";
    }
    fetch(BASE_PATH + url,
    {
        method: "POST",
        headers: {
            'Authorization': user['token'],
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(json)
    })
    .then(function(res){
        if(res.ok){
            return res.json();
        }
        throw res;
    })
    .then(function(data) {
        fun(data);
    }).catch( err => {
        err.text().then( errorMessage => {
            window.alert('Error: ' + errorMessage);
        })
    })
}

function getApi(fun, url, id = null){
    if(id != null){
        url += '/' + id;
    }
    fetch(BASE_PATH + url)
    .then(function(res){
        if(res.ok){
            return res.json();
        }
        throw res;
    })
    .then(function(data) {
        fun(data);
    }).catch( err => {
        err.text().then( errorMessage => {
            window.alert('Error: ' + errorMessage);
        })
    })
}

//----------------------------------------------- Info Windows -----------------------------------------------//

function bikeInfoWindow(name, forRent){
    let rent = 'already rented';
    let disab = ' disabled'
    if(forRent) {
        rent = 'for rent';
        disab = '';
    }
    const contentString =
    '<div>' +
        '<div class="l-perso-styles">' +
            '<div class="perso-cn">' +
                '<h2> Bike "'+ name +'"🚲</h2>' +
                '<p>This bike is '+rent+'</p>' +
                '<div class="perso-instructions">' +
                    '1. Click on "Rent Bicycle"<br>' +
                    '2. Bicycle lock will unlock automatically<br>' +
                    '3. Adjust saddle height<br>' +
                '</div>' +
            '</div>' +
            '<div class="perso-controls">' +
                '<button class="btn-rent"'+disab+' onclick="rentBike()">RENT BIKE</button>' +
            '</div>' +
        '</div>' +
    "</div>";
    return contentString;
}

function userInfoWindow(){
    let rent = '<p>No bicycle rented :(</p>';
    if(user['rented'] != null && rentedMarker) {
        rent =  '<div class="perso-controls-bike">'+
                    '<h3 style="display:inline;">🚲  </h3><h3 style="display:inline;">"'+ rentedMarker['bike']['name'] +'"</h3>'+
                '</div>'+
                '<button class="btn-return btn-rent" onclick="returnBike()">RETURN BIKE</button>';
    }

    const contentString =
    '<div>'+
        '<div class="l-perso-styles">'+
            '<div class="perso-cn">'+
                '<h2> User "'+ user['name'] +'"  🚴‍♂️</h2>'+
                '<p>How to rent a bicycle</p>'+
                '<div class="perso-instructions">'+
                    '1. Click on "Rent Bicycle"<br>'+
                    '2. Bicycle lock will unlock automatically<br>'+
                    '3. Adjust saddle height<br>'+
                '</div>'+
                '<hr>'+
                '<p>Bicycle rented:</p>'+
            '</div>'+
            '<div class="perso-controls-usr">'+
                rent +
            '</div>'+
        '</div>'+
    '</div>'
    return contentString;
}

//----------------------------------------------- Functions -----------------------------------------------//

function newBikeMarker(bike){
    const infowindow = new google.maps.InfoWindow({
        content: bikeInfoWindow(bike['name'],bike['rented']==null),
        minWidth: 370,
        maxWidth: 340,
    });
    const marker = new google.maps.Marker({
        position: {lat: bike['latitude'], lng: bike['longitude']},
        map: map,
        icon: redIcon,
        animation: google.maps.Animation.DROP,
        title: bike['name'],
        bike: bike,
        infowindow: infowindow
    });
    if (bike['rented']!=null){marker.setIcon(grayIcon);}
    
    marker.addListener("click", () => {
        map.setZoom(zoom1);
        map.panTo(marker.getPosition());
        if (lastMarker) lastMarker['infowindow'].close();
        lastMarker = marker;
        infowindow.open({
            anchor: marker,
            map,
            shouldFocus: false,
        });
    });
    if(bike['rented'] != null && bike['rented']['$oid'] == user['_id']['$oid']){
        rentedMarker = marker;
    }
}

function rentBike(){
    function aux(data){
        rentedMarker = lastMarker;
        user['rented'] = rentedMarker['bike']['_id'];
        rentedMarker['bike']['rented'] = user['_id'];
        rentedMarker.setIcon(grayIcon);
        updateUser();
        updateMarker();
        window.alert(JSON.stringify(data));
    };
    var js = {
        "bike": lastMarker['bike']['_id']['$oid'],
        "user": user['_id']['$oid']
    };
    postApi(aux, 'rent', js);
}

function returnBike(){
    function aux(data){
        user['rented'] = null;
        rentedMarker['bike']['rented'] = null;
        rentedMarker.setIcon(redIcon);
        updateUser();
        updateMarker();
        rentedMarker = false;
        window.alert(JSON.stringify(data));
    };
    var js = {
        "bike": rentedMarker['bike']['_id']['$oid'],
        "user": user['_id']['$oid']
    };
    postApi(aux, 'unrent', js);
}


function testtt(){
    rentedMarker.setIcon(redIcon);
}

function updateUser(){
    localStorage.setItem('user', JSON.stringify(user));
    userMarker.infowindow.setContent(userInfoWindow());
}

function updateMarker(){
    rentedMarker.infowindow.setContent(bikeInfoWindow(rentedMarker['bike']['name'],rentedMarker['bike']['rented']==null));
}



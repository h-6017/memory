//Test app with strophe and xmpp

var Hello = {

    connection: null,
    start_time: null,
    pong_list: [],
    response_total: null,

    log: function (msg) {
        $('#log').append("<p>" + msg + "</p>");
    },

    send_ping: function (to) {
        console.log("Building ping");
        var ping = $iq({
            to: to,
            type: "get",
            id: "ping1"}).c("ping", {xmlns: "urn:xmpp:ping"});

        console.log("Sending ping to " + to + ".");

        Hello.log("Sending ping to " + to + ".");

        Hello.start_time = (new Date()).getTime();
        Hello.connection.send(ping);
    },

    handle_pong: function (iq) {
        console.log("Pong recieved");
        var elapsed = (new Date()).getTime() - Hello.start_time;
        Hello.log("Recieved pong from server in " + elapsed + "ms.");
        Hello.pong_list.push(elapsed);
        Hello.start_time = null;
        $(document).trigger('pong_handled');
    }

};



$(document).ready(function () {
    $('#login_dialog').dialog({
        autoOpen: true,
        draggable: false,
        modal: true,
        title: 'Connect to XMPP',
        buttons: {
            "connect": function () {
                $(document).trigger('connect', {
                    jid: $('#jid').val(),
                    password: $('#password').val()
                });

                $('#password').val('');
                $(this).dialog('close');
            }
        }
    });
});

$(document).bind('connect', function(ev, data) {
    var conn = new Strophe.Connection("http://bosh.metajack.im:5280/xmpp-httpbind");
    conn.connect(data.jid, data.password, function (status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });
    Hello.connection = conn;
});

$(document).bind('pong_handled', function () {

    var pong_count = Hello.pong_list.length;
    console.log("Checking to see how many pongs we have recieved... " + pong_count);

    if(pong_count == 10) {
        for(i = 0; Hello.pong_list[i]; i++) {
            Hello.response_total = Hello.response_total + i;
            console.log(Hello.response_total);
        }
        var avg_ping_response = (Hello.response_total/pong_count);
        Hello.log(avg_ping_response);
        $(document).trigger('avg_calculated');
    } else {
        console.log("Not enough pings yet");
    }
});

$(document).bind('connected', function () {
    //Inform the user
    Hello.log("connection established");


    var domain = Strophe.getDomainFromJid(Hello.connection.jid);
    for(i = 0;i < 10; i++) {
        Hello.connection.addHandler(Hello.handle_pong, null, "iq", null, "ping1");
        console.log("Sending ping in approx. 1.5 min");
        setTimeout(Hello.send_ping(domain), 65000);
        console.log("Sending ping " + (i + 1) + " out... waiting for response");
    }
});

$(document).bind('avg_calculated', function () {
    Hello.log("Thanks for your time. Please have a nice day");
    Hello.connection.disconnect();
    $(document).trigger('disconnected');
});

$(document).bind('disconnected', function () {
    Hello.log("Connection terminated.");
    // remove dead connection object
    hello.connection = null;
});

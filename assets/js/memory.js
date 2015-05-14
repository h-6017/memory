//Test app with strophe and xmpp

var Memo = {

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

        Memo.log("Sending ping to " + to + ".");

        Memo.start_time = (new Date()).getTime();
        Memo.connection.send(ping);
    },

    on_roster: function (iq) {
        $(iq).find('item').each(function () {
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            //transform jid into an id
            var jid_id = Memo.jid_to_id(jid);

            var contact = $("<li id='" + jid_id + "'>" +
                            "<div class='roster-contact offline'>" +
                            "<div class='roster-name'>" +
                            name +
                            "</div><div class='roster-jid'>" +
                            jid +
                            "</div></div></li>");
            Memo.insert_contact(contact);
        });
    },

    jid_to_id: function (jid) {
        return Strophe.getBareIdFromJid(jid)
            .replace("@", "-")
            .replace(".", ".");
    },

    presence_value: function (elem) {
        if (elem.hasClass('online')) {
            return 2;
        } else if (elem.hasClass('away')) {
            return 1;
        }
        return 0;
    },

    insert_contact: function (elem) {
        var jid = elem.find('.roster-jid').text();
        var pres = Memo.presence_value(elem.find('.roster-contact'));

        var contacts = $('#roster-area li');

        if (contacts.length > 0) {
            var inserted = false;
            contacts.each(function () {
                var cmp_pres = Memo.presence_value($(this).find('.roster-contact'));
                var cmp_jis = $(this).find('.roster-jid').text();

                if (pres > cmp_pres) {
                    $(this).before(elem);
                    inserted = true;
                    return false;
                } else {
                    if (jid < cmp_jid) {
                        $(this).before(elem);
                        inserted = true;
                        return false;
                    }
                }
            });

            if (!inserted) {
                $('#roster-area ul').append(elem);
            }
        } else {
            $('#roster-area ul').append(elem);
        }
    },


    handle_pong: function (iq) {
        console.log("Pong recieved");
        var elapsed = (new Date()).getTime() - Memo.start_time;
        Memo.log("Recieved pong from server in " + elapsed + "ms.");
        Memo.pong_list.push(elapsed);
        Memo.start_time = null;
        $(document).trigger('pong_handled');
    }

};



$(document).ready(function () {
    $('#login_dialog').dialog({
        autoOpen: true,
        draggable: true,
        modal: true,
        title: 'Connect to XMPP',
        buttons: {
            "Connect": function () {
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
    var conn = new Strophe.Connection("https://xmpp.codecleric.com:5281/http-bind/");
    conn.connect(data.jid, data.password, function (status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });
    Memo.connection = conn;
});

$(document).bind('pong_handled', function () {

    var pong_count = Memo.pong_list.length;
    console.log("Checking to see how many pongs we have recieved... " + pong_count);

    if(pong_count == 10) {
        for(i = 0; Memo.pong_list[i]; i++) {
            Memo.response_total = Memo.response_total + Memo.pong_list[i];
            console.log(Memo.response_total);
        }
        var avg_ping_response = (Memo.response_total/pong_count);
        Memo.log("The average responce time was: " + avg_ping_response);
        $(document).trigger('avg_calculated');
    } else {
        console.log("Not enough pings yet");
        $(document).trigger('not_enough_pings');
    }
});

$(document).bind('connected', function () {
    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Memo.connection.sendIQ(iq, Memo.on_roster);


    //---Test---
    //Memo.log("connection established");
    //setTimeout($('#log').hide(), 5000);
    //var domain = Strophe.getDomainFromJid(Memo.connection.jid);
    //Memo.connection.addHandler(Memo.handle_pong, null, "iq", null, "ping1");
    //setTimeout(Memo.send_ping, 6500, domain);
});

$(document).bind('not_enough_pings', function () {
    var domain = Strophe.getDomainFromJid(Memo.connection.jid);
    Memo.connection.addHandler(Memo.handle_pong, null, "iq", null, "ping1");
    setTimeout(Memo.send_ping, 65000, domain);
});

$(document).bind('avg_calculated', function () {
    Memo.log("Thanks for your time. Please have a nice day");
    Memo.connection.disconnect();
    return false;
});

$(document).bind('disconnected', function () {
    Memo.log("Connection terminated.");
    // remove dead connection object
    Memo.connection = null;
});

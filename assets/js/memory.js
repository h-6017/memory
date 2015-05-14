//Test app with strophe and xmpp

var Memo = {

    connection: null,
    start_time: null,

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
            console.log("transforming into jid");
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
            console.log("Calling insert_contact while passing in " + contact);
            Memo.insert_contact(contact);
        });

        // set up presence handler and send initial presence
        Memo.connection.addHandler(Memo.on_presence, null, "presence");
        Memo.connection.send($pres());
    },

    on_presence: function (presence) {
        var ptype = $(presence).attr('type');
        var from = $(presence).attr('from');

        if (ptype !== 'error') {
            var contact = $('#roster-area li#' + Memo.jid_to_id(from))
                .removeClass("online")
                .removeClass("away")
                .removeClass("offline");
            if (ptype === 'unavailable') {
                contact.addClass("offline");
            } else {
                var show = $(presence).find("show").text();
                if (show === "" || show === "chat") {
                    contact.addClass("online");
                } else {
                    contact.addClass("away");
                }
            }

            var li = contact.parent();
            li.remove();
            Memo.insert_contact(li);
        }

        return true;
    },



    jid_to_id: function (jid) {
        return Strophe.getBareJidFromJid(jid)
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
        console.log("Got the jid... it is " + jid + ".");
        var pres = Memo.presence_value(elem.find('.roster-contact'));
        console.log("calling presence_value, which happens to be " + pres + ".");

        var contacts = $('#roster-area li');

        if (contacts.length > 0) {
            var inserted = false;
            contacts.each(function () {
                var cmp_pres = Memo.presence_value($(this).find('.roster-contact'));
                var cmp_jid = $(this).find('.roster-jid').text();

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

    on_roster_changed: function (iq) {
        $(iq).find('item').each(function () {
            var sub = $(this).attr('subscription');
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            var jid_id = Memo.jid_to_id(jid);

            if (sub === 'remove') {
                // contact is being removed
                $('#' + jid_id).remove();
            } else {
                //contact is being added or modified
                var contact_html = "<li id='" + jid_id + "'>" +
                    "<div class='" +
                    ($('#' + jid_id).attr('class') || "roster-contact offline") +
                    "'>" +
                    "<div class='roster-name'>" +
                    name +
                    "</div><div class='roster-jid'>" +
                    jid +
                    "</div></div></li>";
                if ($('#' + jid_id).length > 0) {
                    $('#' + jid_id).replaceWith(contact_html);
                } else {
                    Memo.insert_contact(contact_html);
                }
            }
        });

        return true;

    },


    handle_pong: function (iq) {
        console.log("Pong recieved");
        var elapsed = (new Date()).getTime() - Memo.start_time;
        Memo.log("Recieved pong from server in " + elapsed + "ms.");
        Memo.start_time = null;
        return false;
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

    $('#contact_dialog').dialog({
        autoOpen: false,
        dragabble: false,
        modal: true,
        title: 'Add a contact',
        buttons: {
            "Add": function () {
                $(document).trigger('contact_added', {
                    jid: $('#contact-jid').val(),
                    name: $('#contact-name').val()
                });

                $('#contact-jid').val('');
                $('#contact-name').val('');

                $(this).dialog('close');
            }
        }
    });

    $('#new-contact').click(function (ev) {
        $('#contact_dialog').dialog('open');
    });
});

$(document).bind('connect', function(ev, data) {
    var conn = new Strophe.Connection('http://bosh.metajack.im:5280/xmpp-httpbind');
    conn.connect(data.jid, data.password, function (status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });
    Memo.connection = conn;
});


$(document).bind('connected', function () {
    console.log("connection established");
    console.log("Building iq stanza");
    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Memo.connection.sendIQ(iq, Memo.on_roster);

    Memo.connection.addHandler(Memo.on_roster_changed, "jabber:iq:roster", "iq", "set");
});

$(document).bind('disconnected', function () {
    Memo.log("Connection terminated.");
    // remove dead connection object
    Memo.connection = null;
});

$(document).bind('contact_added', function (ev, data) {
    var iq = $iq({type: "set"}).c("query", {xmlns: "jabber:iq:roster"})
        .c("item", data);
    Memo.connection.sendIQ(iq);

    var subscribe = $pres({to: data.jid, "type": "subscribe"});
    Memo.connection.send(subscribe);
});

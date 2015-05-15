//Test app with strophe and xmpp

var Memo = {

    connection: null,
    start_time: null,
    db: null,

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

    on_message: function (message) {
        var jid = Strophe.getBareJidFromJid($(message).attr('from'));
        var jid_id = Memo.jid_to_id(jid);

        /* if ($('#chat-' + jid_id).length === 0) {
            $('#chat-area').tabs('add', '#chat-' + jid_id, jid);
            $('#chat-' + jid_id).append(
                "<div class='chat-messages'></div>" +
                "<input type='text' class='chat-input'>");
            $('#chat-' + jid_id).data('jid', jid);
        }

        $('#chat-area').tabs('select', '#chat-' + jid_id);
        $('#chat-' + jid_id + ' input').focus();
        */
        var body = $(message).find("html > body");

        if (body.length === 0) {
            body = $(message).find('body');
            if (body.length > 0) {
                body = body.text()
            } else {
                body = null;
            }
        } else {
            body = body.contents();
        }

        if (body) {
            // add the new message
            var aKey = new Date().toISOString()
            if (body.startsWith("c ")) {
                // we have a note to save
                var noteParts = body.slice(2).split("|")
            }
            var thisId = aKey + '-' + jid;
            var theDoc = {
                _id: thisId, 
                note: noteParts[1].trim(),
                title: noteParts[0].trim(),
                from: jid,
                date: aKey
            }
            if (Memo.db) {
                Memo.db.put(theDoc);

                Memo.db.get(thisId).then(Memo.showNote);
            }
        }

        return true;

    },
    token: 'M1n10n',
    showNote: function (doc) {
        console.log(doc);
        var id = doc._id.replace('@', '')
        var notesDiv = $('<div id='+ id +' class="note"></div>')
        notesDiv.append('<h5>'+doc.title+'&nbsp;&nbsp;<span class="kill" dbid="'+doc._id+'">[X]</span></h5>')
        notesDiv.append('<p class="text">'+doc.note+'</h5>')
        notesDiv.append('<p class="jid">'+doc.from+'</h5>')
        notesDiv.append('<span class="note_date">'+doc.date+'</span>')
        $('#notes').append(notesDiv)
    },
    scroll_chat: function (jid_id) {
        var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
        div.scrollTop = div.scrollHeight;
    },
    id: 'memori@sudopriest.com',
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

    
    pending_subscriber: null,

    on_presence: function (presence) {
        var ptype = $(presence).attr('type');
        var from = $(presence).attr('from');

        if(ptype === 'subscribe') {
            //populate pending_subscriber, the approve-jid span, and
            //open the dialog
            Memo.pending_subscriber = from;
            $('#approve-jid').text(Strophe.getBareJidFromJid(from));
            $('#approve_dialog').dialog('open');
        } else if (ptype !== 'error') {
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
        if ($(elem).hasClass('online')) {
            return 2;
        } else if ($(elem).hasClass('away')) {
            return 1;
        }
        return 0;
    },

    insert_contact: function (elem) {
        var jid = $(elem).find('.roster-jid').text();
        console.log("Got the jid... it is " + jid + ".");
        var pres = Memo.presence_value($(elem).find('.roster-contact'));
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
    //$('#chat-area').tabs().find('ui-tabs-nav').sortable({axis: 'x'});
    
    $('roster-input').on('keypress', function (ev) {
        if (ev.which === 13) {
            ev.preventDefault();

            var body = $(this).val();
            var jid = $(this).parent().data('jid');

            Memo.connection.send($msg({
                to: jid,
                "type": "chat"
            }).c('body').t(body));

            $(this).parent().find('.chat-messages').append(
                "<div class='chat-message'><" +
                "<span class='chat-name me'>" +
                Strophe.getNodeFromJid(Memo.connection.jid) +
                "</span><span class='chat-text'>" +
                body +
                "</span></div>");
            Memo.scroll_chat(Memo.jid_to_id(jid));

            $(this).val('');
        }
    });

    /*
    $("body").on('click', '.roster-contact',  function () {
        var jid = $(this).find(".roster-jid").text();
        var name = $(this).find(".roster-name").text();
        var jid_id = Memo.jid_to_id(jid);

        if ($('#chat-' + jid_id).length > 0) {
            $('#chat-area').tabs('select', '#chat-' + jid_id);
        } else {
            var tabId = '#chat-' + jid_id
            $("div#chat-area ul").append('<li><a href="' + tabId + '">' + name + '</a></li>')
            $( tabId ).append(
                '<div class="chat-messages"></div>' +
                '<input type="text" class="chat-input"/>');

            $( tabId ).data('jid', jid);
        }

        $( tabId + ' input ').focus();
    });

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
    */
    $(document).trigger('connect', { jid: Memo.id, token: Memo.token });

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

    $('#approve_dialog').dialog({
        autoOpen: false,
        draggable: false,
        modal: true,
        title: 'Subscription Request',
        buttons:{
            "Deny": function() {
                    Memo.connection.send($pres({
                        to: Memo.pending_subscriber,
                        "type": "unsubscribed"}));
                    Memo.pending_subscriber = null;

                    $(this).dialog('close');
                },

                "Approve": function () {
                    Memo.connection.send($pres({
                        to: Memo.pending_subscriber,
                        "type": "subscribed"}));
                    Memo.connection.send($pres({
                        to: Memo.pending_subscriber,
                        "type": "subscribe"}));

                    Memo.pending_subscriber = null;
                    $(this).dialog('close');
            }
        }
    });

    $('#new-contact').click(function (ev) {
        $('#contact_dialog').dialog('open');
    });
    // Show all the notes
    var db = new PouchDB("notes")
    db
        .allDocs({include_docs: true})
        .then(
            function(docs) {
                idx = 0;
                var docObj;
                while(docObj = docs.rows[idx]) {
                    console.log(docObj)
                    
                    if (!docObj.value._deleted) {
                        Memo.showNote(docObj.doc)
                    }
                    idx++;
                }
        });
    $( "body" ).on('click', '.kill', function(e) {
        var dbid = $(this).attr('dbid');
        var id = dbid.replace('@', '')
        db.get(id).then(function(doc) {
            return db.remove(doc);
            console.log("deleted");
            $('#'+id).remove();
            return false;
        })
    });
});

$(document).bind('connect', function(ev, data) {
    var conn = new Strophe.Connection('https://xmpp.codecleric.com:5281/http-bind/');
    conn.connect(data.jid, data.token, function (status) {
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

    Memo.db = new PouchDB('notes');
    Memo.connection.addHandler(Memo.on_message, null, "message", "chat");
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

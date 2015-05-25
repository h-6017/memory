//Test app with strophe and xmpp

var Memo = {

    connection: null,
    start_time: null,
    db: null,

    log: function (msg) {
        $('#log').append("<p>" + msg + "</p>");
    },



    on_message: function (message) {
        var jid = Strophe.getBareJidFromJid($(message).attr('from'));
        var jid_id = Memo.jid_to_id(jid);

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
        if (body.startsWith("json ::")) {
            var json_data = body.slice(8);
            var the_notes = JSON.parse(json_data);
            $(document).trigger('notes-received', the_notes);
        }
    },

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
        var pres = Memo.presence_value($(elem).find('.roster-contact'));

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



};



$(document).ready(function () {
    $('#chat-area').tabs().find('ui-tabs-nav').sortable({axis: 'x'});
    
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

    $( "body" ).on('click', '.kill', function(e) {
        var dbid = $(this).attr('dbid');
        var id = dbid.replace('@', '')
        db.get(dbid).then(function(doc) {
            db.remove(doc);
            console.log("deleted");
            $('div[id="'+id+'"]').remove();
            return false;
        })
    });
});

$(document).bind('notes-received', function(ev, data) {
    console.log("Something happened!");
    for(var note in data['notes']){
        console.log(note);
        Memo.showNote(note);
    }
});

$(document).bind('connect', function(ev, data) {
    var conn = new Strophe.Connection('https://xmpp.codecleric.com:5281/http-bind/');
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
    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Memo.connection.sendIQ(iq, Memo.on_roster);

    Memo.connection.addHandler(Memo.on_roster_changed, "jabber:iq:roster", "iq", "set");

    Memo.connection.addHandler(Memo.on_message, null, "message", "chat");

    console.log("Attempting to request json data...");
    var msg = $msg({to: "memori@sudopriest.com", type: 'chat'}).c("body").t("json");
    console.log(msg);
    Memo.connection.send(msg);
    console.log();
});

$(document).bind('disconnected', function () {
    console.log("Connection terminated.");
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

# __init__.py
# 2010 Jonathan Tsai <akajontsai-devel@yahoo.com> - Exaile 0.3 Wrapper
#
# httpserver.py
# Copyright (C) 2007 Mathieu Virbel <tito@bankiz.org>
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 1, or (at your option)
# any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.

import gtk, threading, gobject, cgi, math
from gettext import gettext as _
from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer

from xl import event, covers, xdg

DEFAULT_PORT = 10000

APP = None
eh_thread = None

# -----------------------------------------------------------------------------
# Exaile 0.3 Wrapper - This plugin was only compatible up to Exaile 0.2
# -----------------------------------------------------------------------------

def enable(exaile):
    global APP
    APP = exaile
    if (exaile.loading):
        event.add_callback(_enable, 'exaile_loaded')
    else:
        _enable(None, exaile, None)
        
def disable(exaile):
    print('httpserver plugin being disabled.')
    destroy()
    
def _enable(eventname, exaile, nothing):
    print('httpserver plugin being enabled.')
    initialize()

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------

def tag(tagname, value):
    """
    Construct a xml tag
    """
    return '<%s>%s</%s>' % (tagname, value, tagname)

MIME_TYPES = {
    # text
    'html': 'text/html; charset=utf-8',
    'js':   'text/html',
    'css':  'text/css',
    # images
    'gif':  'image/gif',
    'jpg':  'image/jpeg',
    'png':  'image/png',
    }

def get_mime_type(filename):
    """
    Get the MIME type of a file
    """
    extension = filename.rsplit('.')[-1]
    if extension not in MIME_TYPES:
        extension = 'html'
    return MIME_TYPES[extension]

def get_hms_len(seconds):
    """
    Get the duration of a track in h:mm:ss format
    """
    hours = int(math.floor(seconds / 3600))
    minutes = int(math.floor((seconds % 3600) / 60))
    if minutes < 10:
        minutes = '0' + str(minutes)
    else:
        minutes = str(minutes)
    seconds = int(seconds) % 60
    if seconds < 10:
        seconds = '0' + str(seconds)
    else:
        seconds = str(seconds)
    hms =  minutes + ':' + seconds
    if hours > 0:
        hms = str(hours) + ':' + duration
    return hms

class TrackInfo:
    """
    Fetch some infos from a Track
    (In case we have no track, set some default value)
    (We also can have reduce information for display a playlist)
    """

    def __init__(self, track = None, playlistmode=False):
        self.infos = {}
        self.infos['filename'] = ''
        self.infos['title']    = _('None')
        self.infos['artist']   = _('None')
        self.infos['album']    = _('None')
        self.infos['bitrate']  = _('None')
        self.infos['rating']   = _('Unknown')
        self.infos['len']      = '0:00' # display length
        self.infos['disc']     = _('None')
        self.infos['genre']    = _('None')
        self.infos['duration'] = '0' # in seconds
        self.infos['is_paused']	= APP.player.is_paused()
        self.infos['is_playing']= APP.player.is_playing()

        if track is not None:
            try:
                track_len = track.get_tag_display('__length')
                self.infos['duration'] = cgi.escape(track_len)
                hms = get_hms_len(int(track_len))
                self.infos['len'] = cgi.escape(hms)
            except Exception as e:
                print e
            self.infos['filename'] = cgi.escape(track.get_tag_display('__loc'))
            self.infos['title'] = cgi.escape(track.get_tag_display('title'))
            self.infos['artist'] = cgi.escape(track.get_tag_display('artist'))
            self.infos['album'] = cgi.escape(track.get_tag_display('album'))
            self.infos['bitrate'] = cgi.escape(track.get_tag_display('__bitrate'))
            self.infos['rating'] = cgi.escape(str(track.get_rating()))
            self.infos['disc'] = cgi.escape(str(track.get_tag_display('discnumber')))
            self.infos['genre'] = cgi.escape(track.get_tag_display('genre'))
        if not playlistmode:
            self.infos['position'] = '0'
            if track is not None:
                self.infos['position'] = cgi.escape(str(APP.player.get_progress()))
                pass



# -----------------------------------------------------------------------------
# Callbacks for HTTP Request
# ----------------------------------------------------------------------------- 

def eh_page_rpc_current(r):
    """
    Get informations from current track
    Response is in XML.
    """
    r.send_response(200, 'OK')
    r.send_header('Content-type', 'text/xml; charset=utf-8')
    r.end_headers()

    ti = TrackInfo(APP.player.current)
    r.wfile.write('<?xml version="1.0"?>')
    request_id = r.path.rsplit('?')[-1].rsplit('=')[-1]
    r.wfile.write('<track>')
    r.wfile.write(tag('request_id', request_id))
    for key in ti.infos:
        r.wfile.write(tag(key, ti.infos[key]))
    r.wfile.write('</track>')


def eh_page_cover_current(r):
    """
    Return the current track cover in a HTTP Response
    Support only jpeg or png file
    """
    track = APP.player.current
    if track is None:
        r.send_error(404,'Not Found')
        return
    cover = covers.MANAGER.get_cover(track)

    #self.send_error(404, 'Not Found')

    r.send_response(200, 'OK')
    mime_type = get_mime_type('jpg')
    r.send_header('Content-type', mime_type)
    r.send_header('Pragma', 'no-cache')
    r.end_headers()

    r.wfile.write(cover)
# end eh_page_cover_current


def eh_page_file(r):
    """
    Return a static file
    Filter is done before.
    """
    r.send_response(200, 'OK')
    mime_type = get_mime_type(r.path)
    r.send_header('Content-type', mime_type)
    r.end_headers()

    path = r.path
    if path == '/':
        path = '/index.html'
    data = open('%(rootdir)s/plugins/httpserver/data%(resource)s' % { 'rootdir': xdg.get_data_dirs()[0], 'resource': path } ).read()
    r.wfile.write(data)


def eh_page_rpc_action(r):
    """
    Handle some player action (play, next, pause...)
    """
    r.send_response(200, 'OK')
    r.send_header('Content-type', 'text/plain')
    r.end_headers()
    r.wfile.write('OK')

    actions = {
        '/rpc/action/pause':    APP.player.toggle_pause,
        '/rpc/action/stop':     APP.player.stop,
        '/rpc/action/next':     APP.player._queue.next,
        '/rpc/action/previous': APP.player._queue.prev,
        }
    playlist = APP.player._queue.current_playlist
    if playlist:
        actions['/rpc/action/repeat'] = playlist.toggle_repeat
        actions['/rpc/action/shuffle'] = playlist.toggle_random
        actions['/rpc/action/dynamic'] = playlist.toggle_dynamic

    paths = r.path.split('?')
    path = paths[0]
    if path == '/rpc/action/play':
        to_play = None
        if len(paths) > 1:
            args = cgi.parse_qs(paths[1])
            print args
            if args.has_key('f') and args['f'] != '' and playlist is not None:
                tracks = playlist.get_ordered_tracks()
                for track in tracks:
                    if track.get_tag_display('__loc') == args['f'][0]:
                        print 'PLAYING filename=%s' % args['f'][0]
                        to_play = track
        gobject.idle_add(APP.player._queue.play, to_play)
    elif path == '/rpc/action/seek':
        args = cgi.parse_qs(paths[1])
        if args.has_key('s') and args['s'] != '':
            seek_pos = int(args['s'][0])
            gobject.idle_add(APP.player.seek, seek_pos)
    elif path in actions:
        callbacks = actions[path]
        for callback in callbacks:
            gobject.idle_add(callback)
# end eh_page_rpc_action

def eh_page_playlist_list(r):
    """
    Return track informations from current playlist
    """
    r.send_response(200, 'OK')
    r.send_header('Content-type', 'text/xml; charset=utf-8')
    r.end_headers()

    r.wfile.write('<?xml version="1.0"?>')
    r.wfile.write('<playlist>')
    playlist = APP.player._queue.current_playlist
    if playlist is not None:
        tracks = playlist.get_ordered_tracks()
        for track in tracks:
            ti = TrackInfo(track, playlistmode=True)
            r.wfile.write('<track>')
            for key in ti.infos:
                r.wfile.write(tag(key, ti.infos[key]))
            r.wfile.write('</track>')
    r.wfile.write('</playlist>')


# -----------------------------------------------------------------------------
# HTTP server
# -----------------------------------------------------------------------------

eh_pages = {
    # Dynamic content
    '/image/cover/current': eh_page_cover_current,

    # RPC url
    '/rpc/current':         eh_page_rpc_current,
    '/rpc/action/play':     eh_page_rpc_action,
    '/rpc/action/stop':     eh_page_rpc_action,
    '/rpc/action/next':     eh_page_rpc_action,
    '/rpc/action/previous': eh_page_rpc_action,
    '/rpc/action/pause':    eh_page_rpc_action,
    '/rpc/action/seek':     eh_page_rpc_action,
    '/rpc/action/repeat':   eh_page_rpc_action,
    '/rpc/action/shuffle':  eh_page_rpc_action,
    '/rpc/action/dynamic':  eh_page_rpc_action,
    '/rpc/playlist/list':   eh_page_playlist_list,

    # Data
    '/':                    eh_page_file,
    '/index.html':          eh_page_file,
    '/exaile.css':          eh_page_file,
    '/exaile.js':           eh_page_file,
    '/prototype.js':        eh_page_file,
    '/btn-play.png':        eh_page_file,
    '/btn-stop.png':        eh_page_file,
    '/btn-pause.png':       eh_page_file,
    '/btn-next.png':        eh_page_file,
    '/btn-previous.png':    eh_page_file,
    '/btn-repeat.png':      eh_page_file,
    '/btn-reload.png':      eh_page_file,
    '/star.png':            eh_page_file,
    '/btn-shuffle.png':     eh_page_file,
    '/btn-dynamic.png':     eh_page_file,
    '/loading.gif':         eh_page_file,
    '/bg-trans.png':        eh_page_file,
    }

class ExaileHttpRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):

        path = self.path.split('?')[0]
        if eh_pages.has_key(path):
            eh_pages[path](self)
        else:
            self.send_error(404,'Not Found')
            return

        return

    @staticmethod
    def serve_forever(port):
        HTTPServer(('', port), ExaileHttpRequestHandler).serve_forever()
# end ExaileHttpRequestHandler

class ExaileHttpThread(threading.Thread):

    def __init__(self):
        threading.Thread.__init__(self)

    def run(self):
        print 'HTTP> http://127.0.0.1:%d/' % DEFAULT_PORT
        ExaileHttpRequestHandler.serve_forever(DEFAULT_PORT)



# -----------------------------------------------------------------------------
# Exaile interface
# -----------------------------------------------------------------------------

def initialize():
    global eh_thread
    eh_thread = ExaileHttpThread()
    eh_thread.setDaemon(True)
    eh_thread.start()

def destroy():
    global eh_thread
    if eh_thread is not None:
        del eh_thread
        eh_thread = None

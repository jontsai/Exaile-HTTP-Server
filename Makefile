#
# Makefile for Exaile HTTP Server plugin
# Author: Jonathan Tsai <akajontsai-devel@yahoo.com>
#

all: httpserver.exz

httpserver.exz:
	tar czvf httpserver.exz httpserver

clean:
	rm -rf *.exz

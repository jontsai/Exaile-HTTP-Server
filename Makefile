#
# Makefile for Exaile HTTP Server plugin
# Author: Jonathan Tsai <akajontsai-devel@yahoo.com>
#

all: clean httpserver.exz

httpserver.exz: httpserver/MANIFEST
	echo "Creating plugin archive..."
	tar czvf httpserver.exz httpserver

httpserver/MANIFEST:
	echo "Generating MANIFEST..."
	find httpserver/data -type f | sed 's/httpserver\/data//' > httpserver/MANIFEST

clean:
	echo "Cleaning files..."
	rm -f *.exz
	rm -f httpserver/*.pyc
	rm -f httpserver/MANIFEST
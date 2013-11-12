/**
 * Link autocomplete for MediaWiki editbox
 * Author: Vitaliy Filippov
 * License: MPL 2.0+ (http://www.mozilla.org/MPL/2.0/)
 */

$(document).ready(function()
{
	var ta = document.getElementById('wpTextbox1');
	if (!ta)
	{
		return;
	}
	// Create overlay for textarea
	var tao = document.createElement('div');
	var tas = document.createElement('span');
	var tas2 = document.createElement('span');
	var isset;
	tao.appendChild(tas);
	tao.appendChild(tas2);
	ta.parentNode.style.position = 'relative';
	ta.style.zIndex = '2';
	tao.style.visibility = 'hidden';
	tao.style.position = 'absolute';
	// Copy styles to overlay
	tao.style.padding = tao.style.top = tao.style.left = tao.style.right = tao.style.bottom = 0;
	tao.style.whiteSpace = 'pre-wrap';
	tao.style.boxSizing = 'border-box';
	tao.style.border = '1px solid transparent';
	tao.style.overflowWrap = 'break-word';
	tao.style.wordWrap = 'break-word';
	tao.style.mozWordWrap = 'break-word';
	tao.style.fontFamily = $(ta).css('font-family');
	tao.style.fontSize = $(ta).css('font-size');
	// Function to escape special HTML/XML characters
	function htmlspecialchars(s)
	{
		s = s.replace(/&/g, '&amp;'); //&
		s = s.replace(/</g, '&lt;'); //<
		s = s.replace(/>/g, '&gt;'); //>
		s = s.replace(/"/g, '&quot;'); //"
		return s;
	}
	ta.parentNode.insertBefore(tao, ta);
	// Helper functions and local variables
	var linkstart, linkend, linkrel = null, hinttop, hintleft, last_q = null;
	var findChars = function(i, chars)
	{
		var j;
		for (j = i; j < ta.value.length && chars.indexOf(ta.value[j]) == -1; j++) {}
		return j;
	};
	var findCharsBack = function(i, chars)
	{
		var j;
		for (j = i; j >= 0 && chars.indexOf(ta.value[j]) == -1; j--) {}
		return j;
	};
	var findLinkEnd = function()
	{
		linkend = findChars(linkstart, '\n\r|]#');
		if (linkend >= ta.value.length || ta.value[linkend] == '\n' || ta.value[linkend] == '\r')
		{
			// Do not cut to the end of line if none of ] | # characters are found
			linkend = findChars(linkstart, ' \t\n\r');
		}
	};
	var setHintPos = function(pos)
	{
		if (!isset)
		{
			tao.style.lineHeight = $(ta).css('line-height');
			isset = true;
		}
		// Find closest whitespace character - we'll cut up to it for correct wrapping
		j = findChars(pos, ' \t\n\r');
		// Copy text to overlay to calculate cursor position
		tao.style.overflowY = ta.scrollHeight > ta.clientHeight ? 'scroll' : '';
		tas.innerHTML = htmlspecialchars(ta.value.substr(0, pos));
		tas2.innerHTML = htmlspecialchars(ta.value.substr(pos, j));
		var rects = tas.getClientRects(),
			lastRect = rects[rects.length-1];
		hinttop = lastRect.bottom - ta.scrollTop + document.documentElement.scrollTop,
		hintleft = lastRect.right;
	};
	var showHint = function(opts)
	{
		if (opts.length)
		{
			linkhint.hintLayer.style.top = hinttop+'px';
			linkhint.hintLayer.style.left = hintleft+'px';
			linkhint.hintLayer.style.display = '';
		}
		linkhint.replaceItems(opts);
	};
	var handlePageLink = function(i)
	{
		i--;
		linkstart = i+2;
		if (ta.value[linkstart] == ':')
		{
			linkstart++;
		}
		findLinkEnd();
		setHintPos(linkstart);
		// Handle relative links
		var curend = (ta.selectionStart < linkend && ta.selectionStart > linkstart) ? ta.selectionStart : linkend;
		var q = ta.value.substr(linkstart, curend-linkstart).trim();
		linkrel = null;
		if (q[0] == '/')
		{
			// Subpage
			linkrel = mw.config.get('wgTitle');
			q = mw.config.get('wgCanonicalNamespace') + ':' + linkrel + q;
			linkrel = [ linkrel.length, '' ];
		}
		else if (q[0] == '.' && q[1] == '.')
		{
			// Relative up-link
			var rel = /^(\.\.\/)+/.exec(q);
			if (rel)
			{
				var up = rel[0].length/3;
				linkrel = mw.config.get('wgTitle').replace(new RegExp("((/|^)[^/]*){"+up+"}$"), '');
				if (linkrel == mw.config.get('wgTitle'))
				{
					// Too many levels up
					linkhint.replaceItems([]);
					return;
				}
				q = mw.config.get('wgCanonicalNamespace') + ':' + linkrel + q.substr(rel[0].length-1);
				linkrel = [ linkrel.length, rel[0].substr(0, rel[0].length-1) ];
			}
		}
		if (last_q !== 'page:'+q)
		{
			last_q = 'page:'+q;
			// Make an AJAX call to standard MW autocomplete API
			$.ajax({
				url: mw.util.wikiScript('api'),
				type: 'GET',
				dataType: 'json',
				data: {
					action: 'opensearch',
					format: 'json',
					search: q,
					canonicalns: 1,
					suggest: ''
				},
				success: function(data)
				{
					var opts = [];
					for (var i in data[1])
					{
						opts.push([ data[1][i], data[1][i] ]);
					}
					showHint(opts);
				}
			});
		}
	};
	var handlePageSection = function(i)
	{
		var page = ta.value.substr(i+1, linkstart-i-2);
		if (page == '')
		{
			page = mw.config.get('wgCanonicalNamespace')+':'+mw.config.get('wgTitle');
		}
		findLinkEnd();
		var curend = (ta.selectionStart < linkend && ta.selectionStart > linkstart) ? ta.selectionStart : linkend;
		var q = ta.value.substr(linkstart, curend-linkstart).trim();
		if (last_q !== 'sections:'+page)
		{
			last_q = 'sections:'+page;
			$.ajax({
				url: mw.util.wikiScript('api'),
				type: 'GET',
				dataType: 'json',
				data: {
					action: 'parse',
					format: 'json',
					prop: 'sections',
					page: page
				},
				success: function(data)
				{
					var opts = [];
					if (data && data.parse && data.parse.sections)
					{
						for (var i in data.parse.sections)
						{
							opts.push([ data.parse.sections[i].number+'. '+data.parse.sections[i].line, data.parse.sections[i].line ]);
						}
					}
					showHint(opts);
				}
			});
		}
	};
	// Create SimpleAutocomplete...
	var linkhint = new SimpleAutocomplete(ta, function(linkhint)
	{
		linkstart = -1;
		var i = findCharsBack(ta.selectionStart-1, '\n\r[]#');
		if (i > 0 && ta.value[i] == '[' && ta.value[i-1] == '[')
		{
			handlePageLink(i);
		}
		else if (ta.value[i] == '#')
		{
			// Save # position
			linkstart = i+1;
			setHintPos(linkstart);
			i = findCharsBack(i, '\n\r[]{}');
			if (i > 0 && ta.value[i] == '[' && ta.value[i-1] == '[')
			{
				// # actually begins after [[ - we are inside a page link
				handlePageSection(i);
			}
		}
		else
		{
			last_q = null;
			linkhint.replaceItems([]);
		}
	});
	linkhint.addRmListener('mousedown', function() {
		linkhint.onChange();
	});
	// ...and override some of its methods
	// Because of this overriding, minified and mangled hinter doesn't work
	linkhint.onChange = function(force)
	{
		if (!this.delay || force)
		{
			this.dataLoader(this, null, this.more);
		}
		else if (!this.timer)
		{
			var self = this;
			this.timer = setTimeout(function() {
				self.dataLoader(self, null, self.more);
				self.timer = null;
			}, this.delay);
		}
	};
	linkhint.show = function() {};
	linkhint.selectItem = function(index)
	{
		var v = this.items[index][1];
		if (linkrel !== null)
		{
			// This is needed to insert relative links
			v = linkrel[1] + v.replace(/^[^:]*:/, '').substr(linkrel[0]);
		}
		if (this.input.value[linkend] != ']' && this.input.value[linkend] != '|' &&
			this.input.value[linkend] != '#')
		{
			v += ']]';
		}
		this.input.value = this.input.value.substr(0, linkstart) + v + this.input.value.substr(linkend);
		this.input.selectionStart = this.input.selectionEnd = linkstart + v.length;
		this.hide();
		last_q = null;
		this.input.focus();
	};
});

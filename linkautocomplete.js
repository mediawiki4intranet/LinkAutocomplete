/**
 * Link autocomplete for MediaWiki editbox
 * Author: Vitaliy Filippov
 * License: MPL 2.0+ (http://www.mozilla.org/MPL/2.0/)
 */

$(document).ready(function()
{
	var ta = document.getElementById('wpTextbox1');
	var tplRegexp = 'Template|Шаблон';
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
	// Helper functions and local variables
	var linkstart, linkend, linkafter = null, linkrel = null, last_q = null;
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
	var findLinkEnd = function(chars)
	{
		// Never cut anything
		linkend = ta.selectionStart;
	};
	var setHintPos = function()
	{
		if (!tao.parentNode)
		{
			// Wrap textarea in a div if WikiEditor is not loaded
			if (ta.parentNode.className.substr(0, 11) != 'wikiEditor-')
			{
				var np = document.createElement('div');
				ta.parentNode.insertBefore(np, ta);
				np.appendChild(ta);
				ta.focus();
			}
			ta.parentNode.style.position = 'relative';
			ta.parentNode.insertBefore(tao, ta);
		}
		if (!isset)
		{
			tao.style.lineHeight = $(ta).css('line-height');
			isset = true;
		}
	};
	var showHint = function(opts)
	{
		if (opts.length)
		{
			// Find closest whitespace character - we'll cut up to it for correct wrapping
			j = findChars(linkstart, ' \t\n\r');
			// Copy text to overlay to calculate cursor position
			tao.style.overflowY = ta.scrollHeight > ta.clientHeight ? 'scroll' : '';
			tas.innerHTML = htmlspecialchars(ta.value.substr(0, linkstart));
			tas2.innerHTML = htmlspecialchars(ta.value.substr(linkstart, j));
			var rects = tas.getClientRects(),
				lastRect = rects[rects.length-1],
				hinttop = lastRect.bottom - ta.scrollTop + document.documentElement.scrollTop + document.body.scrollTop,
				hintleft = lastRect.right;
			linkhint.hintLayer.style.top = hinttop+'px';
			linkhint.hintLayer.style.left = hintleft+'px';
			linkhint.hintLayer.style.display = '';
		}
		linkhint.replaceItems(opts);
	};
	// Suggest either a page link or a template, if is_tpl is true
	var handlePageLink = function(i, is_tpl)
	{
		i--;
		linkstart = i+2;
		if (!is_tpl && ta.value[linkstart] == ':')
		{
			linkstart++;
		}
		findLinkEnd();
		setHintPos();
		// Handle relative links
		var curend = ta.selectionStart > linkstart ? ta.selectionStart : linkend;
		var q = ta.value.substr(linkstart, curend-linkstart).trim();
		linkrel = null;
		// First letter is always uppercased
		q = q.substr(0, 1).toUpperCase()+q.substr(1);
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
		else if (is_tpl)
		{
			if (q[0] == ':')
			{
				// First letter is second, re-uppercase it
				q = q.substr(1, 1).toUpperCase()+q.substr(2);
			}
			else if (!new RegExp('^('+tplRegexp+'):').exec(q))
			{
				q = 'Template:'+q;
			}
		}
		linkafter = is_tpl ? [ '|}', '}}', 0, '|', '}}' ] : [ '|]#', ']]', 2, '|', ']]' ];
		if (last_q !== (is_tpl ? 'tpl:' : 'page:') + q)
		{
			last_q = (is_tpl ? 'tpl:' : 'page:') + q;
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
					if (is_tpl && !linkrel)
					{
						for (var i in data[1])
						{
							var m = new RegExp('^('+tplRegexp+'):(.*)$').exec(data[1][i]);
							m = m ? m[2] : ':'+data[1][i];
							opts.push([ data[1][i], m ]);
						}
					}
					else
					{
						for (var i in data[1])
						{
							opts.push([ data[1][i], data[1][i] ]);
						}
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
		var curend = ta.selectionStart > linkstart ? ta.selectionStart : linkend;
		var q = ta.value.substr(linkstart, curend-linkstart).trim();
		linkafter = [ '|]', ']]', 2, '|', ']]' ];
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
	var pfs;
	var handleParserFunction = function(i, sfh_hash)
	{
		findLinkEnd();
		var curend = ta.selectionStart > linkstart ? ta.selectionStart : linkstart;
		var q = ta.value.substr(linkstart, curend-linkstart).trim();
		if (sfh_hash)
		{
			q = '#'+q;
		}
		q = q.toLowerCase();
		if (last_q !== 'pf:'+q)
		{
			last_q = 'pf:'+q;
			linkrel = sfh_hash ? [ 1, '' ] : null;
			linkafter = [ ':}', ': }}', 2, ': ', '}}' ];
			var showPFHint = function()
			{
				var opts = [];
				var last = '';
				for (var i = 0; i < pfs.length; i++)
				{
					if (pfs[i][0].substr(0, q.length).toLowerCase() == q)
					{
						if (pfs[i][1] != last)
						{
							opts.push([ pfs[i][1], '', true ]);
							last = pfs[i][1];
						}
						opts.push([ pfs[i][0], pfs[i][0] ]);
					}
				}
				showHint(opts);
			};
			if (!pfs)
			{
				// Parser functions are only loaded 1 time
				$.ajax({
					url: mw.config.get('wgScript'),
					type: 'GET',
					dataType: 'json',
					data: {
						action: 'ajax',
						rs: 'efLinkAutocomplete_ParserFunctions'
					},
					success: function(data) {
						pfs = data;
						showPFHint();
					}
				});
			}
			else
			{
				showPFHint();
			}
		}
	};
	// Create SimpleAutocomplete...
	var linkhint = new SimpleAutocomplete(ta, function(linkhint)
	{
		linkstart = -1;
		var i = findCharsBack(ta.selectionStart-1, '\n\r[]#{}|');
		if (i > 0 && ta.value[i] == '[' && ta.value[i-1] == '[')
		{
			// Page link
			handlePageLink(i);
			return;
		}
		if (i > 0 && ta.value[i] == '{' && ta.value[i-1] == '{')
		{
			// Template link
			handlePageLink(i, true);
			return;
		}
		if (ta.value[i] == '#')
		{
			// Maybe a hashed parser function of a page section
			// Save position of '#'
			linkstart = i+1;
			setHintPos();
			for (i--; i >= 0 && ' \t'.indexOf(ta.value[i]) != -1; i--) {}
			if (i > 0 && ta.value[i] == '{' && ta.value[i-1] == '{')
			{
				// # begins just after {{ - it's a hashed parser function
				if (ta.value.substr(i, ta.selectionStart-i).indexOf(':') == -1)
				{
					// ...and we are not inside the parameter list
					handleParserFunction(i, true);
					return;
				}
			}
			else
			{
				i = findCharsBack(i, '\n\r[]{}');
				if (i > 0 && ta.value[i] == '[' && ta.value[i-1] == '[')
				{
					// # begins after [[ - we are inside a page link
					handlePageSection(i);
					return;
				}
			}
		}
		last_q = null;
		linkhint.replaceItems([]);
	}, { useTab: true });
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
		findLinkEnd();
		// linkafter[0] = chars that prevent inserting linkafter[1] if found at linkend
		// linkafter[1] = what to insert if no preventing chars are found
		// linkafter[2] = cursor offset from inserted link after inserting linkafter[1]
		// linkafter[3,4] = prefix and suffix for wrapping text up to the first space
		//   if the link is inserted before a non-space character
		//   i.e. ^Some text --> [[L^Some text --> [[Link|Some]] text
		//   but ^ Some text --> [[L^ Some text --> [[Link]] Some text
		var after = linkafter[0].indexOf(ta.value[linkend]) == -1;
		var pos = 0;
		if (after)
		{
			// If the cursor is at non-space character, wrap up to
			// the first space, while respecting {} and [] brace nesting
			var space = /\s/.exec(ta.value[linkend]);
			if (!space)
			{
				var stack = [];
				var re = /[\[\]\s\{\}]/g; // tags?
				var m;
				var i = linkend;
				while (i < ta.value.length)
				{
					re.lastIndex = i;
					m = re.exec(ta.value);
					if (!m)
					{
						i = ta.value.length;
						break;
					}
					i = re.lastIndex;
					if (m[0] == '{')
					{
						stack.push('}');
					}
					else if (m[0] == '{')
					{
						stack.push(']');
					}
					else if (stack.length)
					{
						if (m[0] == stack[stack.length-1])
						{
							stack.pop();
						}
					}
					else
					{
						i--;
						break;
					}
				}
				after = linkafter[3] + ta.value.substr(linkend, i-linkend) + linkafter[4];
				// Place cursor after wrap prefix
				pos = linkafter[3].length;
				linkend = i;
			}
			else
			{
				after = linkafter[1];
				// Place cursor after autocompleted text + as specified in linkafter[2]
				pos = linkafter[2];
			}
		}
		else
		{
			after = '';
		}
		ta.focus();
		if (/WebKit/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent))
		{
			// This is needed for Undo to work in WebKit browsers (and only in them)
			ta.setSelectionRange(linkstart, linkend);
			document.execCommand('insertText', false, v + after);
		}
		else
		{
			ta.value = ta.value.substr(0, linkstart) + v + after +
				ta.value.substr(linkend);
		}
		ta.selectionStart = ta.selectionEnd = linkstart + v.length + pos;
		this.hide();
		last_q = null;
	};
});

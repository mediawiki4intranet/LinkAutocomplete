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
	tao.style.lineHeight = $(ta).css('line-height');
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
	var linkstart, linkend, linkrel;
	// Create SimpleAutocomplete...
	var linkhint = new SimpleAutocomplete(ta, function(linkhint)
	{
		linkstart = -1;
		for (var i = ta.selectionStart-2; i >= 0 &&
			ta.value[i] != '\n' && ta.value[i] != '\r' &&
			(ta.value[i] != ']' || ta.value[i+1] != ']'); i--)
		{
			if (ta.value[i] == '[' && ta.value[i+1] == '[')
			{
				linkstart = i+2;
				if (ta.value[linkstart] == ':')
				{
					linkstart++;
				}
				for (var j = i; j < ta.value.length &&
					ta.value[j] != '\n' && ta.value[j] != '\r' &&
					ta.value[j] != '|' && ta.value[j] != ']' && ta.value[j] != '#'; j++) {}
				linkend = j;
				// Find closest whitespace character - we'll cut up to it for correct wrapping
				for (; j < ta.value.length && ta.value[j] != '\n' && ta.value[j] != '\r' &&
					ta.value[j] != ' ' && ta.value[j] != '\t'; j++) {}
				var curend = (ta.selectionStart < linkend && ta.selectionStart > linkstart) ? ta.selectionStart : linkend;
				// Copy text to overlay to calculate cursor position
				tao.style.overflowY = ta.scrollHeight > ta.clientHeight ? 'scroll' : '';
				tas.innerHTML = htmlspecialchars(ta.value.substr(0, linkstart));
				tas2.innerHTML = htmlspecialchars(ta.value.substr(linkstart, j));
				var rects = tas.getClientRects(),
					lastRect = rects[rects.length-1],
					top = lastRect.bottom - ta.scrollTop + document.documentElement.scrollTop,
					left = lastRect.right;
				// Handle relative links
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
							linkstart = -1;
							break;
						}
						q = mw.config.get('wgCanonicalNamespace') + ':' + linkrel + q.substr(rel[0].length-1);
						linkrel = [ linkrel.length, rel[0].substr(0, rel[0].length-1) ];
					}
				}
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
						if (opts.length)
						{
							linkhint.hintLayer.style.top = top+'px';
							linkhint.hintLayer.style.left = left+'px';
							linkhint.hintLayer.style.display = '';
						}
						linkhint.replaceItems(opts);
					}
				});
				break;
			}
		}
		if (linkstart == -1)
		{
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
			// Insert relative links
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
		this.input.focus();
	};
});

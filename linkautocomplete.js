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
	tao.appendChild(tas);
	ta.parentNode.style.position = 'relative';
	ta.style.zIndex = '2';
	tao.style.visibility = 'hidden';
	tao.style.position = 'absolute';
	// Copy styles to overlay
	tao.style.padding = tao.style.top = tao.style.left = tao.style.right = tao.style.bottom = 0;
	tao.style.whiteSpace = 'pre-wrap';
	tao.style.boxSizing = 'border-box';
	tao.style.border = '1px solid transparent';
	tas.style.overflowWrap = 'break-word';
	tas.style.wordWrap = 'break-word';
	tas.style.mozWordWrap = 'break-word';
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
	var linkstart, linkend;
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
					ta.value[j] != '|' && ta.value[j] != ']'; j++) {}
				linkend = j;
				var curend = (ta.selectionStart < linkend && ta.selectionStart > linkstart) ? ta.selectionStart : linkend;
				// Copy text to overlay to calculate cursor position
				tao.style.overflowY = ta.scrollHeight > ta.clientHeight ? 'scroll' : '';
				tas.innerHTML = htmlspecialchars(ta.value.substr(0, linkstart));
				var rects = tas.getClientRects(),
					lastRect = rects[rects.length-1],
					top = lastRect.bottom - ta.scrollTop + document.documentElement.scrollTop,
					left = lastRect.right;
				// Make an AJAX call to standard MW autocomplete API
				$.ajax({
					url: mw.util.wikiScript('api'),
					type: 'GET',
					dataType: 'json',
					data: {
						action: 'opensearch',
						format: 'json',
						search: ta.value.substr(linkstart, curend-linkstart).trim(),
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
				})
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
		if (this.input.value[linkend] != ']' && this.input.value[linkend] != '|')
		{
			v += ']]';
		}
		this.input.value = this.input.value.substr(0, linkstart) + v + this.input.value.substr(linkend);
		this.input.selectionStart = this.input.selectionEnd = linkstart + v.length;
		this.hide();
		this.input.focus();
	};
});

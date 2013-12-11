<?php

/**
 * Link autocompleter for MediaWiki
 *
 * Copyright 2013 Vitaliy Filippov <vitalif@mail.ru>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * @file
 * @ingroup Extensions
 * @author Vitaliy Filippov <vitalif@mail.ru>
 */

# TODO: Correctly autocomplete magic words like {{FULLPAGENAME}} and __NOTOC__
# TODO: Autocomplete SFH_NO_HASH parser functions
# TODO: Autocomplete template and parser function parameters
# TODO: Autocomplete semantic properties [[Property::Value]]
# TODO: Maybe cache loaded items?

$wgHooks['BeforePageDisplay'][] = 'efLinkAutocomplete_BPD';
$wgExtensionFunctions[] = 'efLinkAutocomplete';
$wgAjaxExportList[] = 'efLinkAutocomplete_ParserFunctions';

$wgResourceModules['LinkAutocomplete'] = array(
    'localBasePath' => __DIR__,
    'remoteExtPath' => basename(__DIR__),
    'scripts' => array('hinter.js', 'linkautocomplete.js'),
    'styles' => array('hinter.css'),
    'class' => 'ResourceLoaderLinkAutocompleteModule',
);

$wgExtensionCredits['other'][] = array(
    'name'           => 'LinkAutocomplete',
    'version'        => '2013-10-21',
    'author'         => 'Vitaliy Filippov',
    'url'            => 'http://wiki.4intra.net/LinkAutocomplete',
    'description'    => 'Link autocompleter for MediaWiki editbox',
);

// Append magic word data to the linkautocomplete script
class ResourceLoaderLinkAutocompleteModule extends ResourceLoaderFileModule
{
    public function getScript(ResourceLoaderContext $context)
    {
        $res = parent::getScript($context);
        $res .= efLinkAutocomplete_ParserFunctions(true);
        return $res;
    }

    public function getScriptURLsForDebug(ResourceLoaderContext $context)
    {
        global $wgScript;
        $res = parent::getScriptURLsForDebug($context);
        $res[] = $wgScript.'?action=ajax&rs=efLinkAutocomplete_ParserFunctions&rsargs[]=1';
        return $res;
    }
}

function efLinkAutocomplete()
{
    global $wgResourceModules;
    if (isset($wgResourceModules['ext.wikiEditor']))
    {
        // Load after WikiEditor if it is present
        $wgResourceModules['LinkAutocomplete']['dependencies'] = array('ext.wikiEditor');
    }
}

function efLinkAutocomplete_BPD(&$out)
{
    global $wgRequest;
    $action = $wgRequest->getVal('action');
    if ($action == 'edit' || $action == 'submit')
    {
        $out->addModules('LinkAutocomplete');
    }
    return true;
}

class TrackingParser extends Parser
{
    var $setters = array();

    // Track setFunctionHook() calls to find out the extension which has registered it
    function setFunctionHook($id, $callback, $flags = 0)
    {
        $setter = 'core';
        foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS) as $frame)
        {
            if (isset($frame['file']) &&
                preg_match('#[/\\\\]extensions[/\\\\]([^/\\\\]*)[/\\\\]#is', $frame['file'], $m) &&
                $m[1] != 'LinkAutocomplete')
            {
                $setter = $m[1];
                break;
            }
        }
        $this->setters[$id] = $setter;
        return parent::setFunctionHook($id, $callback, $flags);
    }
}

function efLinkAutocomplete_ParserFunctions($asScript = false)
{
    global $wgContLang;
    // Initialise parser
    $parser = new TrackingParser();
    $parser->parse(" ", Title::newMainPage(), new ParserOptions);
    $p = new WikiPage($parser->mTitle);
    $parser->mRevisionId = $p->getRevision()->getId();
    // Process magic words
    $result = array();
    $allNames = array_merge(MagicWord::getDoubleUnderscoreArray()->names, MagicWord::getVariableIds());
    foreach ($allNames as $f)
    {
        $mag = MagicWord::get($f);
        foreach ($mag->mSynonyms as $f)
        {
            // Prefer english synonyms
            if (preg_match('/^[\x20-\x7F]+$/', $f))
            {
                break;
            }
        }
        // Some variables have trailing ':' in name...
        $f = rtrim($f, ':');
        // Determine type of this magic word
        if (substr($f, 0, 2) == '__' && substr($f, -2) == '__')
        {
            // Double-underscore switch
            $setter = '__';
        }
        elseif ($parser->getVariableValue($f) !== NULL ||
            $parser->getVariableValue($wgContLang->lc($f)) !== NULL)
        {
            // Variable
            $setter = 'var';
        }
        $result[$f] = array($f, $setter);
    }
    // Process parser functions
    foreach ($parser->mFunctionHooks as $f => $settings)
    {
        $mag = MagicWord::get($f);
        foreach ($mag->mSynonyms as $f)
        {
            // Prefer english synonyms
            if (preg_match('/^[\x20-\x7F]+$/', $f))
            {
                break;
            }
        }
        // Some parser functions also have trailing ':' in name...
        $f = rtrim($f, ':');
        if (!$mag->mCaseSensitive)
        {
            $f = $wgContLang->lc($f);
        }
        if (isset($result[$f]))
        {
            // Most (but not all) variables are listed both in mVariableIds and mFunctionHooks
            // So skip them here
            continue;
        }
        $setter = isset($parser->setters[$f]) ? $parser->setters[$f] : 'core';
        if (!($settings[1] & Parser::SFH_NO_HASH))
        {
            $f = "#$f";
        }
        $result[$f] = array($f, $setter);
    }
    // first list extension functions, then core, then magic words
    $section = array('core' => 1, 'var' => 2, '__' => 3);
    usort($result, function($a, $b) use($section)
    {
        $as = isset($section[$a[1]]) ? $section[$a[1]] : 0;
        $bs = isset($section[$b[1]]) ? $section[$b[1]] : 0;
        if ($as != $bs)
        {
            return $as-$bs;
        }
        // first list lowercase functions
        elseif (mb_strtolower($a[0]{0}) == $a[0]{0} && mb_strtolower($b[0]{0}) != $b[0]{0})
        {
            return -1;
        }
        elseif (mb_strtolower($a[0]{0}) != $a[0]{0} && mb_strtolower($b[0]{0}) == $b[0]{0})
        {
            return 1;
        }
        return strcmp($a[1].'-'.$a[0], $b[1].'-'.$b[0]);
    });
    $result = json_encode(array_values($result));
    return $asScript ? "window.LinkAutocompleteParserFunctions = $result;" : $result;
}

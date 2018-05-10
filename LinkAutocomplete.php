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
);

$wgExtensionCredits['other'][] = array(
    'name'           => 'LinkAutocomplete',
    'version'        => '2013-10-21',
    'author'         => 'Vitaliy Filippov',
    'url'            => 'http://wiki.4intra.net/LinkAutocomplete',
    'description'    => 'Link autocompleter for MediaWiki editbox',
);

function efLinkAutocomplete()
{
    global $wgResourceModules;
    if (isset($wgResourceModules['ext.wikiEditor']))
    {
        $a = &$wgResourceModules['ext.wikiEditor']['dependencies'];
        $a = (array)$a;
        $a[] = 'LinkAutocomplete';
    }
}

function efLinkAutocomplete_BPD($out)
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

function efLinkAutocomplete_ParserFunctions()
{
    $parser = new TrackingParser();
    $parser->firstCallInit();
    $result = array();
    foreach ($parser->mFunctionHooks as $f => $settings)
    {
        $mag = MagicWord::get($f);
        $setter = $parser->setters[$f];
        foreach ($mag->mSynonyms as $f)
        {
            if (!$mag->mCaseSensitive)
            {
                $f = mb_strtolower($f);
            }
            $f = rtrim($f, ':');
            if (preg_match('/^[\x20-\x7F]+$/', $f))
            {
                // Prefer english synonym
                break;
            }
        }
        if (!($settings[1] & Parser::SFH_NO_HASH))
        {
            $f = "#$f";
        }
        $result[] = array($f, $setter);
    }
    usort($result, function($a, $b)
    {
        // first list extension functions
        if ($a[1] == 'core' && $b[1] != 'core')
        {
            return 1;
        }
        elseif ($a[1] != 'core' && $b[1] == 'core')
        {
            return -1;
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
    return json_encode($result);
}

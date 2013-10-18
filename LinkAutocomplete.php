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

$wgHooks['BeforePageDisplay'][] = 'efLinkAutocomplete_BPD';
$wgExtensionFunctions[] = 'efLinkAutocomplete';

$wgResourceModules['LinkAutocomplete'] = array(
    'localBasePath' => __DIR__,
    'remoteExtPath' => basename(__DIR__),
    'scripts' => array('hinter.js', 'linkautocomplete.js'),
    'styles' => array('hinter.css'),
);

$wgExtensionCredits['other'][] = array(
    'name'           => 'LinkAutocomplete',
    'version'        => '2013-10-18',
    'author'         => 'Vitaliy Filippov',
    'url'            => 'http://wiki.4intra.net/LinkAutocomplete',
    'description'    => 'Link autocompleter for MediaWiki editbox',
);

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

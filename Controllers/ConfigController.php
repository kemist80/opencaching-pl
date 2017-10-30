<?php

namespace Controllers;
use lib\Objects\ApplicationContainer;
use Utils\Debug\Debug;

/**
 * This controller read and return requested configuration container
 * - for example $menu for menu config or $config for site configuration.
 *
 * All config files should be stored in: CONFIG_DIR.
 *
 * For all config files there is 3-level hierarchy:
 *   - <config-name>.default.php    - defaults for all nodes, stored in git
 *
 *   - <config-name>.<node-id>.php  - defaults for node, stored in git
 *                                      (node-id can has value: pl|ro|nl|uk...)
 *
 *   - <config-name>.local.php      - settings for local installation -
 *                                    DO NOT STORE LOCAL FILES IN GIT!
 *
 * Node-id is stored read from local site-config.
 *
 */

class ConfigController extends BaseController
{
    const CONFIG_DIR = __DIR__.'/../Config/';
    const MENU_DIR = self::CONFIG_DIR.'Menu/';
    const LEGACY_LOCAL_CONFIG = __DIR__.'/../lib/settings.inc.php';

    const CONFIG_PREFIX = 'config';

    const MENU_FOOTER_PREFIX = 'footerMenu';
    const MENU_ADMIN_PREFIX = 'adminMenu';
    const MENU_AUTH_USER = 'authUserMenu';
    const MENU_NON_AUTH_USER = 'nonAuthUserMenu';
    const MENU_HORIZONTAL_BAR = 'horizontalBarMenu';

    /**
     * Return given menu based on rules:
     *  - return local version of file if present
     *  - next return node-specific version of menu-config file if present
     *  - next return default version of menu file (always should be present!)
     *
     * @param const-string $menuPrefix
     * @return array $menu
     */
    public static function getMenu($menuPrefix)
    {
        $menu = null;

        $localMenuFile = self::MENU_DIR."$menuPrefix.local.php";
        if(is_file($localMenuFile)){
            include($localMenuFile);
            return $menu;
        }

        $ocNode = self::getOcNode();
        $nodeMenuFile = self::MENU_DIR."$menuPrefix.$ocNode.php";
        if(is_file($nodeMenuFile)){
            include($nodeMenuFile);
            return $menu;
        }

        $defaultMenuFile = self::MENU_DIR."$menuPrefix.default.php";
        if(is_file($defaultMenuFile)){
            include($defaultMenuFile);
            return $menu;
        }

        Debug::errorLog("ERROR: Can't load menu file: $menuPrefix");
        return null;
    }

    /**
     * Return $config merged from:
     * - default config file overrirded by
     * - node-config file overrided by
     * - local config file
     *
     * @param string $configName - prefix of the config file - see consts above
     * @return NULL
     */
    private static function getConfig($configName)
    {
        $config = null; //first init local variable
        $ocNode = self::getOcNode();

        $defaultConfigFile  = self::CONFIG_DIR."$configName.default.php";
        $nodeConfigFile     = self::CONFIG_DIR."$configName.$ocNode.php";
        $localConfigFile    = self::CONFIG_DIR."$configName.local.php";

        // load default config
        if(is_file($defaultConfigFile)){
            include($defaultConfigFile);
        }

        // load node config
        if(is_file($nodeConfigFile)){
            include($nodeConfigFile);
        }

        // load local config
        if(is_file($localConfigFile)){
            include($localConfigFile);
        }

        return $config;
    }

    /**
     * Find node identifier in local settings file
     * First try to look to legacy /lib/settings.inc.php.
     * It legacy settings file is not present check /Config/config.local.php.
     *
     * Save nodeId in the ApplicationContext.
     *
     * @return string identifier of the node
     *
     */
    private static function getOcNode()
    {
        if(!is_null($ocNode = ApplicationContainer::GetOcNode())){
            return $ocNode;
        }

        // try to load from legacy config file
        if(is_file(self::LEGACY_LOCAL_CONFIG)){
            include self::LEGACY_LOCAL_CONFIG;

            if(!isset($config['ocNode'])){
                Debug::errorLog(__METHOD__.": ERROR: Can't read config['ocNode'] value".
                    "from file: ".self::LEGACY_LOCAL_CONFIG);

                $config['ocNode'] = "pl";
            }

            ApplicationContainer::SetOcNode($config['ocNode']);
            return $config['ocNode'];
        }

        // try to load from local config file
        $localConfigFile = self::CONFIG_DIR.self::CONFIG_PREFIX.'.local.php';

        if(is_file($localConfigFile)){
            include $localConfigFile;

            if(!isset($config['ocNode'])){
                Debug::errorLog(__METHOD__.": ERROR: Can't read config['ocNode'] value".
                    "from file: $localConfigFile");

                $config['ocNode'] = "pl";
            }

            ApplicationContainer::SetOcNode($config['ocNode']);
            return $config['ocNode'];
        }

        Debug::errorLog(__METHOD__.": ERROR: Can't locate both legacy and non-legacy config files:".
            self::LEGACY_LOCAL_CONFIG.' and '.$localConfigFile);

        // TODO: how to handle such error !?
        echo "FATAL-ERROR!";
        exit;

    }

    public function index()
    {}

}



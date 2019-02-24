<?php
namespace src\Utils\Debug;


class Debug {

    /**
     * Returns backtrace in simple form:
     * file:line | file:line | ...
     *
     * @return string
     */
    public static function getTraceStr()
    {
        $traceStr = '';
        $backtrace = debug_backtrace();

        array_shift($backtrace); //remove first element - call this method...

        $i = 0;
        foreach($backtrace as $trace){
            d($trace);
            $file = isset($trace['file']) ? $trace['file'] : '?';
            $line = isset($trace['line']) ? $trace['line'] : '?';
            $func = isset($trace['function']) ? $trace['function'] : '?';
            $class = isset($trace['class']) ? $trace['class'].'::' : '';

            $traceStr.= "\n  #$i: $file:$line [$class$func()]";
            $i++;
        }
        return $traceStr."\n";
    }

    public static function errorLog($message, $addStackTrace=true){

        if($addStackTrace){
            $message .= "\n  STACKTRACE:".self::getTraceStr();
        }

        error_log($message);
    }

    public static function dumpToLog($var, $message=null){

        if(!is_null($message)){
            $result = $message.': ';
        }else{
            $result = 'var-dump: ';
        }
        $result .= var_export($var, TRUE);
        error_log($result);
    }
}

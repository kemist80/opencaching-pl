<html>
<head>
</head>

<body>
<div id="idGCL"></div>

<?php 
echo "<script type='text/javascript'>";
echo "GCTLoad( 'ChartLine', '', 1 );";
echo "</script>";
?>

   
<script type="text/javascript">
		
	var gcl = new GCT( 'idGCL' );
	gcl.addColumn('date', 'Date');	

	
</script>
	
<?php
$sEND = "";
$sDateCondition = "";


global $lang;

require_once('settings.inc.php');
require_once('language.inc.php');
require_once('cookie.class.php');

if ($cookie->is_set('lang'))
	$lang = $cookie->get('lang');

require_once('db.php');



$sUserIDLine = $_REQUEST[ "UserID"];
$sDateFrom = $_REQUEST[ "DF"];
$sDateTo = $_REQUEST[ "DT"];

if ( $sDateFrom <> "" )
	$sDateCondition .= "and date >='" .$sDateFrom."'"; 

if ( $sDateTo <> "" )
	$sDateCondition .= " and date < '".$sDateTo."' ";

$asUserID = explode(",", $sUserIDLine);


if ( !strlen( $sUserIDLine )  )
	$sEND = tr2('SelectUsers', $lang );

if ( count( $asUserID ) > 10 )
	$sEND = "Wybrano więcej niż dziesięciu - todo ENGLISH";

echo "<script type='text/javascript'>";
if ( $sEND <> "" )
{
	echo "alert( '$sEND' );";
	$asUserID = explode(",", "");	
}
echo "</script>";


$sCondition = "";

$aNrColumn=array();

foreach( $asUserID as $sID )
{
	if( strlen( $sCondition ) )
		$sCondition = $sCondition . " or "; 
	
	$sCondition = $sCondition . "cl.user_id = '". $sID."'"; 	
}

if( strlen( $sCondition ) )
{
	$sConditionUser =" ( " . $sCondition . " )";
	$sCondition =" and ( " . $sCondition . " )";
}

$sCondition .= $sDateCondition;

/////////////////

$dbc = new dataBase();

$query =
"SELECT user_id, username FROM user cl where " . $sConditionUser;
$dbc->multiVariableQuery($query);

$aUserName = array();

while ( $record = $dbc->dbResultFetch() )
{
	$sID = $record[ 'user_id' ];
	$aUserName[ $sID ] = $record[ 'username' ];
}
unset( $dbc );

////////////////////



echo "<script type='text/javascript'>";

$i = 0;
foreach( $asUserID as $sID )
{
	$sName = $aUserName[ $sID ];
	//$sName = $sID;
	echo "gcl.addColumn('number', '$sName');";
	$aNrColumn[ $sID ] = $i;
	$i++;
}


//echo "gcl.addChartOption('vAxis', { title: 'Ilość keszy' } );";
echo " var chartOpt = gcl.getChartOption();";
echo " chartOpt.vAxis.title= '".tr2('NrCaches',$lang)."';";
echo "</script>";

////////////////////////////


$dbc = new dataBase();

$query =
"SELECT year( cl.date) year, month( cl.date ) month, day( cl.date ) day,
		 u.username username, u.user_id user_id,
		COUNT(*) count
		
		FROM
		cache_logs cl
		join caches c on c.cache_id = cl.cache_id
		join user u on cl.user_id = u.user_id

		WHERE cl.deleted=0 AND cl.type=1 "

		. $sCondition .

		"GROUP BY year, month, day, user_id 
		order by year, month, day 	";

$dbc->multiVariableQuery($query);


$nCount = array();

foreach( $asUserID as $sID )
{
	$anCount[ $sID ] = 0;
}


echo "<script type='text/javascript'>";



while ( $record = $dbc->dbResultFetch() )
{
	$nYear = $record['year'];
	$nMonth = $record['month'];
	$nDay = $record['day'];
	
	$sNewDate = "new Date( $nYear, $nMonth, $nDay )";
	$sUserName = $record[ 'username' ];
	$nUserId = $record[ 'user_id' ];
	 
	$anCount[ $nUserId ] += $record[ 'count' ];
	

	echo "
			gcl.addEmptyRow();			
			gcl.addToLastRow( 0, $sNewDate );		
		";
	
	
	$nrCol = $aNrColumn[ $nUserId ];
	$val = $anCount[ $nUserId ];
	echo "gcl.addToLastRow( $nrCol+1 , $val );";
	
}

echo "</script>";

unset( $dbc );
?>


<script type="text/javascript">
	gcl.drawChart( 1 );
</script>  
   
</body>

</html>
<?php
	echo getTideHeight();
	function getTideHeight() {
		$feed_contents = file_get_contents('http://93.62.201.235/maree/ESPORTAZIONI/DATI/Punta_Salute.html');
		$DOM = new DOMDocument;
		$DOM->loadHTML($feed_contents);

		$items = $DOM->getElementsByTagName('td');
		$latestTideLevel = "";
		for ($i = 0; $i < $items->length - 1; $i++)
	    	$latestTideLevel = $items->item($i)->nodeValue;
		return $latestTideLevel;
	}
?>
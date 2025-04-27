function exemple_2() {
	// On récupérer la référence de la node du DOM ayant l'id "div_1"
	let div_1 = document.getElementById("div_1");

	// On va ajouter 2 nodes enfants à notre div 1
	// Un premier text dans une node de type <div>
	let div_node = document.createElement("div");
	div_node.innerText = "Premier ajout";

	// On peut aussi créer une text node directement
	let text_node = document.createTextNode("Deuxième ajout");

	// On ajoute des enfants à div 1
	div_1.appendChild(div_node);
	div_1.appendChild(text_node);
}


function exemple_3() {

	// On supprime l'enfant div 3 de div 2 (en passant par le parent)
	let div_2 = document.getElementById("div_2");
	let div_3 = document.getElementById("div_3");
	div_2.removeChild(div_3);

	// On supprime div 4 (directement)
	let div_4 = document.getElementById("div_4");
	div_4.remove();

	// On ne peut supprimer qu'une fois
	let button = document.getElementById("delete_button");
	button.onclick = () => { alert("On ne peut supprimer qu'une fois !");}

}

function exemple_4() {
	// On change la classe de style
	let div_5 = document.getElementById("div_5");
	div_5.className = "greenbox";

}

// Exemple 5
const text_input = document.getElementById("text_input");
const text_div = document.getElementById("text_div");

// event.target est égal à text_input (ça peut être pratique dans certains cas)
text_input.addEventListener("input", (event) => { text_div.innerText = event.target.value; });


// Exemple 6
let list = document.getElementById("list");
let loop_button = document.getElementById("loop_button");
let is_dev = true;
// boolean pour garder en mémoire sur la "boucle" est censée tourner
let loop = false;

function manage_loop() {

	// On inverse de booléen
	loop = !loop;

	if (!loop) {
		// Si l'ancien état était true (la loupe tourne)
		// maintenant il est a false (elle ne tourne plus)
		loop_button.innerHTML = "Start";
	} else {
		// Si l'ancien état était false (la loop en tourne pas)
		// il faut la démarrer
		loop_button.innerHTML = "Stop";
		ajouter_elements();
	}
}

function ajouter_elements() {

	// Quand on arrete la boucle, le dernier event planifié n'est pas
	// annulé, on bloque l'appel supplémentaire avec ce test
	// supprimez ce test pour tester ce comportement
	if (!loop) {
		return
	}
	// Remarque: setTimout (plus bas) retourne un identifiant, on peut annuler
	// un event planifié avec clearTimeout(timeout_id)

	// Si is_dev est vrai, on veut cette fois afficher Ops
	let text = "Dev"
	if (is_dev) {
		text = "Ops"
	}

	// créer une élément de liste et l'ajouter
	element = document.createElement("li");
	element.innerText = text;
	list.appendChild(element);

	// On
	is_dev = !is_dev;
	// On prépare le prochain appel pour dans 1 seconde
	if (loop) {
		setTimeout(()=> ajouter_elements(), 1000)
	}
}
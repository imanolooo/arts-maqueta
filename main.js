import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

let scene, camera, renderer, cameraRig, controls;
const moveSpeed = 0.05; // Velocitat del joystick

init();

function init() {
    const container = document.getElementById('canvas-container');

    // 1. ESCENA I RENDER
    scene = new THREE.Scene();
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.xr.enabled = true; 
    container.appendChild(renderer.domElement);

    // 2. RIG DE LA CÀMERA (VR)
    cameraRig = new THREE.Group();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Per al PC, posem la posició directament a la càmera (així les OrbitControls funcionen)
    camera.position.set(0, 2, 5); 
    
    cameraRig.add(camera);
    scene.add(cameraRig);

    // 3. CONTROLS DE L'ORDINADOR (Ratolí)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Fa que el moviment del ratolí sigui més suau i fluid
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);  // Punt central on mirarà la càmera de l'ordinador
    controls.update();

    // INTERRUPTOR AUTOMÀTIC: Ordinador <--> Ulleres VR
    // Quan cliquis el botó d'entrar a VR, ressituem la càmera per a les ulleres
    renderer.xr.addEventListener('sessionstart', () => {
        cameraRig.position.set(0, 0, 5); // El Rig agafa la posició base
        camera.position.set(0, 0, 0);    // La càmera es neteja perquè les ulleres en controlin el cap
    });

    // Si deus sortir del mode VR, tornem a activar el mode ordinador netament
    renderer.xr.addEventListener('sessionend', () => {
        camera.position.set(0, 2, 5);
        cameraRig.position.set(0, 0, 0);
        controls.target.set(0, 1, 0);
        controls.update();
    });

// 4. IL·LUMINACIÓ AUTOMÀTICA AMB PAISATGE EXR
    const exrLoader = new EXRLoader();
    
    // Canvia 'el_teu_paisatge.exr' pel nom real del teu fitxer de natura
    exrLoader.load('textures/resting_place_2k.exr', function (texture) {
        
        texture.mapping = THREE.EquirectangularReflectionMapping;
        
        scene.environment = texture; // Il·lumina la maqueta amb la llum del prat
        scene.background = texture;  // Mostra el cel i la gespa de fons
        
        console.log("Il·luminació i fons EXR carregats correctament!");
    }, undefined, function (error) {
        console.error("Error al carregar l'arxiu EXR:", error);
    });

// 5. CARREGAR LA MAQUETA I CONFIGURAR ELS MATERIALS COM A MATS
    const loader = new GLTFLoader();
    
    loader.load('models/arts.glb', function (gltf) {
        const model = gltf.scene;

        model.traverse(function (child) {
            if (child.isMesh) {
                
                
                if (child.material) {
                    // Si el teu material és una llista (multimaterial), ho apliquem a tots
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    
                    materials.forEach(mat => {
                        // 2. Configurem el material perquè utilitzi l'ombrejat suau
                        mat.flatShading = false;
                        
                        // 3. Mantenim els ajustos de textura mat que volies
                        mat.roughness = 1.0;
                        mat.metalness = 0.0;
                        
                        // Si veus el relleu massa fort, pots ajustar la intensitat aquí (0.5 és un bon punt)
                        if (mat.normalMap && mat.normalScale) {
                            mat.normalScale.set(0.5, 0.5);
                        }

                        // AFEGEIX AQUESTA LÍNIA:
                        mat.needsUpdate = true; // Obliga a Three.js a repintar el material amb el canvi
                    });
                }
            }
        });

        scene.add(model);
        console.log("Maqueta mat carregada amb èxit!");
    }, undefined, function (error) {
        console.error("Error en carregar el model:", error);
    });

    // 6. BOTÓ VR
    document.body.appendChild(VRButton.createButton(renderer));

    window.addEventListener('resize', onWindowResize);

    // Bucle d'animació de Three.js
    renderer.setAnimationLoop(renderLoop);
}

function renderLoop() {
    handleVRMovement();

    if (!renderer.xr.isPresenting) {
        controls.update();
    }

    renderer.render(scene, camera);
}

// MOVIMENT AMB EL JOYSTICK
function handleVRMovement() {
    const session = renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes.length >= 4) {
            const axes = source.gamepad.axes;
            const joystickX = axes[2];
            const joystickY = axes[3];

            if (Math.abs(joystickX) > 0.1 || Math.abs(joystickY) > 0.1) {
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                
                direction.y = 0; // Evita que el nen voli o s'enfonsi
                direction.normalize();

                // Davant / Darrere
                cameraRig.position.addScaledVector(direction, -joystickY * moveSpeed);

                // Lateral
                const sideDirection = new THREE.Vector3(-direction.z, 0, direction.x);
                cameraRig.position.addScaledVector(sideDirection, joystickX * moveSpeed);
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

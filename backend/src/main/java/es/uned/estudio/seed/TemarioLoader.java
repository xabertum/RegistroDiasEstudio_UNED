package es.uned.estudio.seed;

import es.uned.estudio.model.Asignatura;
import es.uned.estudio.model.Tema;
import es.uned.estudio.repository.AsignaturaRepository;
import es.uned.estudio.repository.TemaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Sincroniza la base de datos con temario.json en cada arranque.
 * <p>
 * Las asignaturas nuevas se crean. En las existentes se actualizan los datos de la guía y, si el árbol
 * del temario ha cambiado, se reemplaza conservando lo estudiado en los apartados que mantienen el mismo título.
 */
@Component
public class TemarioLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TemarioLoader.class);

    private final AsignaturaRepository asignaturas;
    private final TemaRepository temas;
    private final JsonMapper jsonMapper;

    public TemarioLoader(AsignaturaRepository asignaturas, TemaRepository temas, JsonMapper jsonMapper) {
        this.asignaturas = asignaturas;
        this.temas = temas;
        this.jsonMapper = jsonMapper;
    }

    record NodoJson(String titulo, List<NodoJson> hijos) {

        List<NodoJson> hijosOVacio() {
            return hijos == null ? List.of() : hijos;
        }
    }

    record AsignaturaJson(String codigo, String nombre, String libro,
                          LocalDateTime examenSemana1, LocalDateTime examenSemana2, List<NodoJson> temas) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        List<AsignaturaJson> datos;
        try (InputStream in = new ClassPathResource("temario.json").getInputStream()) {
            datos = jsonMapper.readValue(in, new TypeReference<>() {
            });
        }
        sincronizar(datos);
    }

    @Transactional
    void sincronizar(List<AsignaturaJson> datos) {
        for (AsignaturaJson a : datos) {
            asignaturas.findByCodigo(a.codigo()).ifPresentOrElse(
                    existente -> actualizar(existente, a),
                    () -> crear(a));
        }
    }

    private void crear(AsignaturaJson a) {
        Asignatura asignatura = asignaturas.save(
                new Asignatura(a.codigo(), a.nombre(), a.libro(), a.examenSemana1(), a.examenSemana2()));
        guardar(asignatura, null, "", a.temas(), Map.of());
        log.info("Asignatura {} creada con su temario", a.nombre());
    }

    private void actualizar(Asignatura asignatura, AsignaturaJson a) {
        asignatura.actualizarDatos(a.nombre(), a.libro(), a.examenSemana1(), a.examenSemana2());

        List<Tema> actuales = temas.findByAsignaturaIdOrderByOrdenAsc(asignatura.getId());
        Map<Long, Tema> porId = new HashMap<>();
        actuales.forEach(t -> porId.put(t.getId(), t));
        if (estructura(actuales, porId).equals(estructura(a.temas()))) {
            return;
        }

        Map<String, Tema> previosPorRuta = new HashMap<>();
        actuales.forEach(t -> previosPorRuta.put(ruta(t, porId), t));

        // Primero los nodos más profundos, para no violar la clave ajena del padre
        List<Tema> borrar = new ArrayList<>(actuales);
        borrar.sort(Comparator.comparingInt((Tema t) -> profundidad(t, porId)).reversed());
        temas.deleteAll(borrar);
        temas.flush();

        guardar(asignatura, null, "", a.temas(), previosPorRuta);
        long conservados = previosPorRuta.values().stream().filter(Tema::isEstudiado).count();
        log.info("Temario de {} actualizado ({} nodos anteriores, {} estaban estudiados)",
                a.nombre(), actuales.size(), conservados);
    }

    /** Guarda los nodos de un nivel recuperando el estado anterior por ruta de títulos; devuelve los creados. */
    private List<Tema> guardar(Asignatura asignatura, Tema padre, String rutaPadre,
                               List<NodoJson> nodos, Map<String, Tema> previos) {
        List<Tema> creados = new ArrayList<>();
        if (nodos == null) {
            return creados;
        }
        for (int i = 0; i < nodos.size(); i++) {
            NodoJson n = nodos.get(i);
            String ruta = rutaPadre + "/" + n.titulo();
            Tema tema = temas.save(new Tema(asignatura, padre, n.titulo(), i));

            if (n.hijosOVacio().isEmpty()) {
                Tema previo = previos.get(ruta);
                if (previo != null && previo.isEstudiado()) {
                    tema.marcar(true, previo.getFechaEstudiado());
                }
            } else {
                List<Tema> hijos = guardar(asignatura, tema, ruta, n.hijos(), previos);
                if (hijos.stream().allMatch(Tema::isEstudiado)) {
                    tema.marcar(true, hijos.stream().map(Tema::getFechaEstudiado).filter(Objects::nonNull)
                            .max(Comparator.naturalOrder()).orElse(null));
                }
            }
            creados.add(tema);
        }
        return creados;
    }

    private static String ruta(Tema tema, Map<Long, Tema> porId) {
        Tema padre = porId.get(tema.getPadreId());
        return (padre == null ? "" : ruta(padre, porId)) + "/" + tema.getTitulo();
    }

    private static int profundidad(Tema tema, Map<Long, Tema> porId) {
        Tema padre = porId.get(tema.getPadreId());
        return padre == null ? 0 : 1 + profundidad(padre, porId);
    }

    /** Huella del árbol: ruta de cada nodo con su posición entre los hermanos. */
    private static Set<String> estructura(List<Tema> actuales, Map<Long, Tema> porId) {
        Set<String> huella = new HashSet<>();
        actuales.forEach(t -> huella.add(t.getOrden() + ":" + ruta(t, porId)));
        return huella;
    }

    private static Set<String> estructura(List<NodoJson> nodos) {
        Set<String> huella = new HashSet<>();
        recogerHuella(nodos, "", huella);
        return huella;
    }

    private static void recogerHuella(List<NodoJson> nodos, String rutaPadre, Set<String> huella) {
        if (nodos == null) {
            return;
        }
        for (int i = 0; i < nodos.size(); i++) {
            String ruta = rutaPadre + "/" + nodos.get(i).titulo();
            huella.add(i + ":" + ruta);
            recogerHuella(nodos.get(i).hijos(), ruta, huella);
        }
    }
}

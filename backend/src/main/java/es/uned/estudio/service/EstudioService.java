package es.uned.estudio.service;

import es.uned.estudio.model.Asignatura;
import es.uned.estudio.model.Tema;
import es.uned.estudio.repository.AsignaturaRepository;
import es.uned.estudio.repository.TemaRepository;
import es.uned.estudio.web.Dtos.AsignaturaDetalle;
import es.uned.estudio.web.Dtos.AsignaturaResumen;
import es.uned.estudio.web.Dtos.TemaNodo;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class EstudioService {

    private final AsignaturaRepository asignaturas;
    private final TemaRepository temas;
    private final Clock clock;

    public EstudioService(AsignaturaRepository asignaturas, TemaRepository temas, Clock clock) {
        this.asignaturas = asignaturas;
        this.temas = temas;
        this.clock = clock;
    }

    public List<AsignaturaResumen> listar() {
        return asignaturas.findAll().stream()
                .map(a -> temario(a).resumen())
                .sorted(Comparator.comparing(AsignaturaResumen::fechaExamen))
                .toList();
    }

    public AsignaturaDetalle detalle(Long asignaturaId) {
        return temario(buscarAsignatura(asignaturaId)).detalle();
    }

    @Transactional
    public AsignaturaResumen cambiarSemana(Long asignaturaId, int semana) {
        Asignatura asignatura = buscarAsignatura(asignaturaId);
        asignatura.setSemanaElegida(semana);
        return temario(asignatura).resumen();
    }

    /**
     * Marca un nodo y todos sus descendientes, y recalcula el estado de sus antecesores
     * (un nodo con hijos está estudiado solo si lo están todos sus hijos).
     */
    @Transactional
    public AsignaturaDetalle marcarTema(Long temaId, boolean estudiado) {
        Tema tema = temas.findById(temaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tema no encontrado"));
        Temario temario = temario(tema.getAsignatura());
        LocalDate hoy = LocalDate.now(clock);

        temario.marcarRama(tema, estudiado, hoy);
        Long padreId = tema.getPadreId();
        while (padreId != null) {
            Tema padre = temario.porId.get(padreId);
            padre.marcar(temario.hijosDe(padre).stream().allMatch(Tema::isEstudiado), hoy);
            padreId = padre.getPadreId();
        }
        return temario.detalle();
    }

    private Asignatura buscarAsignatura(Long id) {
        return asignaturas.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asignatura no encontrada"));
    }

    private Temario temario(Asignatura asignatura) {
        return new Temario(asignatura, temas.findByAsignaturaIdOrderByOrdenAsc(asignatura.getId()));
    }

    /** Árbol de temas de una asignatura, cargado en memoria con una sola consulta. */
    private final class Temario {

        private final Asignatura asignatura;
        private final Map<Long, Tema> porId;
        private final Map<Long, List<Tema>> hijosPorPadre = new HashMap<>();
        private final List<Tema> raices = new ArrayList<>();

        Temario(Asignatura asignatura, List<Tema> nodos) {
            this.asignatura = asignatura;
            this.porId = nodos.stream().collect(Collectors.toMap(Tema::getId, Function.identity()));
            for (Tema t : nodos) {
                if (t.getPadreId() == null) {
                    raices.add(t);
                } else {
                    hijosPorPadre.computeIfAbsent(t.getPadreId(), k -> new ArrayList<>()).add(t);
                }
            }
        }

        List<Tema> hijosDe(Tema tema) {
            return hijosPorPadre.getOrDefault(tema.getId(), List.of());
        }

        void marcarRama(Tema tema, boolean estudiado, LocalDate hoy) {
            tema.marcar(estudiado, hoy);
            hijosDe(tema).forEach(h -> marcarRama(h, estudiado, hoy));
        }

        TemaNodo nodo(Tema tema) {
            List<TemaNodo> hijos = hijosDe(tema).stream().map(this::nodo).toList();
            int total = hijos.isEmpty() ? 1 : hijos.stream().mapToInt(TemaNodo::totalApartados).sum();
            int hechos = hijos.isEmpty()
                    ? (tema.isEstudiado() ? 1 : 0)
                    : hijos.stream().mapToInt(TemaNodo::apartadosEstudiados).sum();
            return new TemaNodo(tema.getId(), tema.getTitulo(), tema.isEstudiado(), tema.getFechaEstudiado(),
                    total, hechos, hijos);
        }

        AsignaturaDetalle detalle() {
            List<TemaNodo> arbol = raices.stream().map(this::nodo).toList();
            return new AsignaturaDetalle(resumen(arbol), arbol);
        }

        AsignaturaResumen resumen() {
            return resumen(raices.stream().map(this::nodo).toList());
        }

        private AsignaturaResumen resumen(List<TemaNodo> arbol) {
            long dias = ChronoUnit.DAYS.between(LocalDate.now(clock), asignatura.getFechaExamen().toLocalDate());
            return new AsignaturaResumen(
                    asignatura.getId(),
                    asignatura.getCodigo(),
                    asignatura.getNombre(),
                    asignatura.getLibro(),
                    asignatura.getExamenSemana1(),
                    asignatura.getExamenSemana2(),
                    asignatura.getSemanaElegida(),
                    asignatura.getFechaExamen(),
                    dias,
                    arbol.stream().mapToInt(TemaNodo::totalApartados).sum(),
                    arbol.stream().mapToInt(TemaNodo::apartadosEstudiados).sum());
        }
    }
}

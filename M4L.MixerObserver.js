autowatch = 1;

("use strict");

outlets = 3;

var VOLUME_OUTLET = 0;
var ACTIVATOR_OUTLET = 1;
var MUTED_VIA_SOLO_OUTLET = 2;

var MAX_DEVICE_TYPE = "MaxDevice";
var TRACK_TYPE = "Track";
var CHAIN_TYPE = "Chain";

var HACK_EPSILON = 7.6293945e-6;

var MAX_AMPLITUDE = 2.;

LEVEL_TABLE = [
  0.000316227757, 0.00047863042, 0.000678161916, 0.00089949806, 0.00111686415,
  0.00138038537, 0.00169824471, 0.00207969709, 0.00253513036, 0.00307609793,
  0.00371535379, 0.00446683681, 0.00534564583, 0.00636795721, 0.00755092687,
  0.00891251024, 0.0104712909, 0.0122461701, 0.0142560853, 0.0165196247,
  0.0190546215, 0.0218776297, 0.0250034742, 0.0284446273, 0.0322107077,
  0.0363078304, 0.0407380499, 0.0454988442, 0.0505825058, 0.0559758097,
  0.0616595633, 0.0676083565, 0.0737904906, 0.0801678821, 0.0866962522,
  0.0933255106, 0.100000083, 0.106659703, 0.113240138, 0.119674154, 0.125892654,
  0.13182579, 0.138038531, 0.14454408, 0.151356235, 0.158489451, 0.165958822,
  0.173780203, 0.181970209, 0.190546185, 0.19952634, 0.208929718, 0.218776271,
  0.229086861, 0.239883393, 0.251188725, 0.263026893, 0.275422931, 0.288403213,
  0.301995218, 0.316227794, 0.33113113, 0.346736848, 0.363078028, 0.380189359,
  0.398107111, 0.416869313, 0.436515749, 0.457088113, 0.478630036, 0.501187205,
  0.524807394, 0.549540818, 0.57543987, 0.602559566, 0.630957305, 0.660693407,
  0.691830933, 0.724435925, 0.758577585, 0.794328212, 0.831763744, 0.870963573,
  0.912010848, 0.954992592, 1, 1.04712844, 1.0964781, 1.14815354, 1.20226431,
  1.25892532, 1.31825662, 1.38038421, 1.4454397, 1.51356113, 1.58489311,
  1.65958679, 1.73780084, 1.81970084, 1.90546072, 1.99526238,
];

var muted_via_solo_reducer = new PropertyValueReducer(
  make_sender(MUTED_VIA_SOLO_OUTLET)
);
var activator_reducer = new PropertyValueReducer(make_sender(ACTIVATOR_OUTLET));
var volume_reducer = new PropertyValueReducer(make_sender(VOLUME_OUTLET));

var reducers = [muted_via_solo_reducer, activator_reducer, volume_reducer];

setinletassist(
  0,
  "The LOM ID of the current device. Triggers rebuilding of the observer chains."
);
setoutletassist(
  0,
  "The product of the values of all of the containing chains' volume faders" +
    " as well as the track volume fader."
);
setoutletassist(
  1,
  "0 if any of the chain activator buttons of the containing chains or the track" +
    " activator button of the containing track are toggled off; 1 otherwise."
);
setoutletassist(
  2,
  "0 if any of the containing chains or the containing track are muted by solo;" +
    " 1 otherwise."
);

function make_sender(outlet_index) {
  return function (value_to_send) {
    outlet(outlet_index, value_to_send);
  };
}
function is_lom_object_valid(lom_object) {
  return lom_object && "id" in lom_object && lom_object.id !== "0";
}
is_lom_object_valid.local = 1;

function PropertyValue(path_or_id, property, value_decorator) {
  this.suppress_updates = true;

  this.value = null;
  this.value_decorator = value_decorator;

  var callback_parent = this;
  this.lom_object = new LiveAPI(function (args) {
    callback_parent.callback(args);
  }, path_or_id);
  this.lom_object.property = property;

  this.on_value_update = null;

  this.suppress_updates = false;
}
PropertyValue.prototype.callback = function (args) {
  if (
    is_lom_object_valid(this.lom_object) &&
    args.length >= 2 &&
    args[0] === this.lom_object.property
  ) {
    this.value = this.value_decorator(args[1]);

    if (!this.suppress_updates && this.on_value_update) {
      this.on_value_update();
    }
  }
};
PropertyValue.local = 1;

function PropertyValueReducer(sender) {
  this.property_values = [];
  this.sender = sender;
}
PropertyValueReducer.prototype.add_property_value = function (property_value) {
  var us = this;
  property_value.on_value_update = this.reduce.bind(us);
  this.property_values.push(property_value);
};
PropertyValueReducer.prototype.reduce = function () {
  if (this.sender) {
    var product = this.property_values
      .map(function (property_value) {
        return property_value.value;
      })
      .reduce(function (accum, current) {
        return accum * current;
      }, 1);

    this.sender(product);
  }
};
PropertyValueReducer.local = 1;

function id(id) {
  clear_observers();
  install_observers(id);
}

function clear_observers() {
  reducers.forEach(function (reducer) {
    reducer.property_values.forEach(function (property_value) {
      property_value.lom_object.id = 0;
    });
    reducer.property_values = [];
  });
}
clear_observers.local = 1;

function install_observers(id) {
  if (id) {
    var lom_object = new LiveAPI("id " + id);

    if (lom_object.type !== MAX_DEVICE_TYPE) return;

    while (lom_object.type !== TRACK_TYPE) {
      lom_object = new LiveAPI(lom_object.get("canonical_parent"));

      if (lom_object.type === CHAIN_TYPE) {
        setup_observers_for_track_or_chain(lom_object);
      }
    }
    setup_observers_for_track_or_chain(lom_object);

    reducers.forEach(function (reducer) {
      reducer.reduce();
    });
  }
}
install_observers.local = 1;

function setup_observers_for_track_or_chain(track_or_chain) {
  if (!is_master_track(track_or_chain)) {
    var muted_via_solo_property_value = new PropertyValue(
      track_or_chain.path,
      "muted_via_solo",
      function (value) {
        return 1 - value;
      }
    );
    muted_via_solo_reducer.add_property_value(muted_via_solo_property_value);
  }

  var mixer_device = new LiveAPI(track_or_chain.get("mixer_device"));

  var activator_child_name = null;
  ["track_activator", "chain_activator"].forEach(function (name) {
    if (mixer_device.children.indexOf(name) >= 0) {
      activator_child_name = name;
    }
  });
  var activator_property_value = new PropertyValue(
    mixer_device.get(activator_child_name),
    "value",
    function (value) {
      return value;
    }
  );
  activator_reducer.add_property_value(activator_property_value);

  var volume_property_value = new PropertyValue(
    mixer_device.get("volume"),
    "value",
    internaltolevel
  );
  volume_reducer.add_property_value(volume_property_value);
}
setup_observers_for_track_or_chain.local = 1;

function is_master_track(lom_object) {
    return (new LiveAPI("live_set master_track").id) == lom_object.id
}

function internaltolevel(internal_value) {
  if (internal_value == 0) return 0;

  var scaled = Math.max(Math.min(internal_value * 100, 100), 0);
  var index = Math.floor(scaled);
  var interp_factor = scaled % 1;

  if (index == LEVEL_TABLE.length - 1) {
    return LEVEL_TABLE[LEVEL_TABLE.length - 1];
  } else {
    var distance = LEVEL_TABLE[index + 1] - LEVEL_TABLE[index];
    var amplitude = LEVEL_TABLE[index] + distance * interp_factor;

    if (Math.abs(1 - amplitude) <= HACK_EPSILON) amplitude = 1;

    return amplitude;
  }
}
internaltolevel.local = 1;
